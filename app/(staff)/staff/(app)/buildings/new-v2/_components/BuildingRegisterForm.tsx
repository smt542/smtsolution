"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { useAppToast } from "@/hooks/common";
import { useMe } from "@/hooks/reactquery/auth";
import {
  useAttachmentsByEntities,
  useDeleteAttachment,
  useUploadAttachments,
  type Attachment,
} from "@/hooks/reactquery/attachments";
import { useSaveBuilding, useStaffOptions, useBuildingFull } from "@/hooks/reactquery/buildings";
import { useBuildingTypes } from "@/hooks/reactquery/buildingTypes";
import { RegisterHeader } from "./RegisterHeader";
import { BasicInfoSection } from "./sections/BasicInfoSection";
import { VendorAssignmentSection } from "./sections/VendorAssignmentSection";
import { ReserveFundSection } from "./sections/ReserveFundSection";
import { OwnerInfoSection } from "./sections/OwnerInfoSection";
import { ExtraInfoSection } from "./sections/ExtraInfoSection";
import { BuildingMemoSection } from "./sections/BuildingMemoSection";
import {
  initialFormState,
  buildingToFormState,
  formStateToPayload,
  type RegisterFormState,
} from "./config/formState";

/**
 * 건물 등록/상세 재설계 폼 (Figma 673:55474) — 6개 섹션 통합 저장.
 * 등록 모드(buildingId 없음)·수정 모드(buildingId) 를 한 컴포넌트에서 처리한다.
 */
export function BuildingRegisterForm({ buildingId }: { buildingId?: number }) {
  const confirm = useConfirm();
  const appToast = useAppToast();
  const router = useRouter();
  const save = useSaveBuilding();
  const uploadAttachments = useUploadAttachments();
  const deleteAttachment = useDeleteAttachment();
  const isSavingBuilding = save.isPending || uploadAttachments.isPending;
  const { data: me } = useMe();
  const { data: staff } = useStaffOptions();
  const { data: types } = useBuildingTypes();
  const { data: full, isLoading: fullLoading } = useBuildingFull(buildingId ?? 0);

  const [state, setState] = useState<RegisterFormState>(initialFormState);
  const [dirty, setDirty] = useState(false);
  const [hydratedFor, setHydratedFor] = useState<number | null>(null);
  const [persistedBuildingId, setPersistedBuildingId] = useState<number | null>(buildingId ?? null);
  const vendorIds = (full?.vendors ?? []).map((vendor) => vendor.id);
  const { data: vendorAttachments = [] } = useAttachmentsByEntities("building_vendor", vendorIds);

  // 담당자 이름 ↔ userId, 건물 유형 라벨 ↔ id 해석기.
  const resolvers = useMemo(() => {
    const activeStaff = (staff ?? []).filter((s) => s.isActive);
    const nameToId = new Map<string, string>();
    const idToName = new Map<string, string>();
    for (const s of activeStaff) {
      if (!nameToId.has(s.fullName)) nameToId.set(s.fullName, s.userId);
      idToName.set(s.userId, s.fullName);
    }
    const labelToId = new Map<string, number>();
    const idToLabel = new Map<number, string>();
    for (const t of types ?? []) {
      labelToId.set(t.label, t.id);
      idToLabel.set(t.id, t.label);
    }
    return {
      staffNames: Array.from(new Set(activeStaff.map((s) => s.fullName))),
      typeLabels: (types ?? []).map((t) => t.label),
      resolveStaffId: (name: string) => nameToId.get(name) ?? null,
      resolveStaffName: (id: string | null) => (id ? idToName.get(id) ?? "" : ""),
      resolveTypeId: (label: string) => labelToId.get(label) ?? null,
      resolveTypeLabel: (id: number | null) => (id != null ? idToLabel.get(id) ?? "" : ""),
    };
  }, [staff, types]);

  // 수정 모드: 로드된 건물 + 해석기 준비 시 렌더 단계에서 1회 하이드레이션(effect 미사용).
  // 참조: React "props가 바뀔 때 state 조정" 패턴(가드된 render-phase setState).
  if (buildingId && full && staff !== undefined && types !== undefined && hydratedFor !== buildingId) {
    setState(buildingToFormState(full, resolvers.resolveStaffName, resolvers.resolveTypeLabel));
    setHydratedFor(buildingId);
  }

  const patch = (p: Partial<RegisterFormState>) => {
    setState((s) => ({ ...s, ...p }));
    setDirty(true);
  };

  const onSave = async () => {
    if (isSavingBuilding) return;
    if (!/^\d{3}$/.test(state.code)) {
      appToast.warning("건물 코드를 숫자 3자리로 입력해 주세요.");
      return;
    }
    if (!state.name.trim()) {
      appToast.error("건물명을 입력해 주세요.");
      return;
    }
      if (!state.address.trim()) {
        appToast.error("주소를 입력해 주세요.");
        return;
      }
      if (!me?.orgId) {
        appToast.error("인증 정보를 확인하지 못했습니다.");
        return;
      }
      const unnamedPhotoVendor = Object.values(state.vendors).find(
        (vendor) => vendor.pendingFiles.length > 0 && !vendor.fields["업체명"]?.trim(),
      );
      if (unnamedPhotoVendor) {
        appToast.error("계약서 사진을 저장하려면 업체명을 입력해 주세요.");
        return;
      }

      const payload = formStateToPayload(state, {
        id: persistedBuildingId,
        resolveStaffId: resolvers.resolveStaffId,
        resolveTypeId: resolvers.resolveTypeId,
        carry: { cleaningUserId: full?.cleaningUserId ?? null, facilities: full?.facilities ?? null },
      });

      try {
        const result = await save.mutateAsync(payload);
        setPersistedBuildingId(result.buildingId);
        const createdVendorIds = new Map(result.vendors.map((vendor) => [vendor.clientKey, vendor.id]));
        const failedByVendorKey = new Map<string, File[]>();
        const persistedVendorIds = new Map<string, number>();

        for (const [vendorKey, vendor] of Object.entries(state.vendors)) {
          const vendorId = vendor.persistedId
            ?? vendor.normalized?.id
            ?? createdVendorIds.get(`register-${vendorKey}`);
          if (vendorId) persistedVendorIds.set(vendorKey, vendorId);
          if (vendor.pendingFiles.length === 0) continue;
          if (!vendorId) {
            failedByVendorKey.set(vendorKey, vendor.pendingFiles);
            continue;
          }

          try {
            const uploadResult = await uploadAttachments.mutateAsync({
              entityType: "building_vendor",
              entityId: vendorId,
              orgId: me.orgId,
              kind: "contract",
              fileType: "image",
              files: vendor.pendingFiles,
            });
            failedByVendorKey.set(vendorKey, uploadResult.failed.map(({ file }) => file));
          } catch {
            failedByVendorKey.set(vendorKey, vendor.pendingFiles);
          }
        }

        setState((current) => ({
          ...current,
          vendors: Object.fromEntries(Object.entries(current.vendors).map(([vendorKey, vendor]) => [
            vendorKey,
            {
              ...vendor,
              persistedId: persistedVendorIds.get(vendorKey) ?? vendor.persistedId,
              pendingFiles: failedByVendorKey.get(vendorKey) ?? vendor.pendingFiles,
            },
          ])),
        }));

        const failedCount = [...failedByVendorKey.values()].reduce(
          (total, files) => total + files.length,
          0,
        );
        if (failedCount > 0) {
          appToast.warning(
            `건물은 저장됐지만 사진 ${failedCount}장을 올리지 못했습니다. 실패한 사진만 다시 저장해 주세요.`,
          );
          setDirty(true);
          return;
        }

        appToast.success("저장되었습니다.");
        setDirty(false);
        if (buildingId) router.refresh();
        else router.replace(`/staff/buildings/${result.buildingId}`);
      } catch (error) {
        appToast.error(error, "건물을 저장하지 못했습니다.");
      }
  };

  const onDeleteAttachment = async (attachment: Attachment) => {
    const accepted = await confirm({
      title: "계약서 사진 삭제",
      description: `${attachment.fileName} 파일을 삭제할까요?`,
      confirmLabel: "삭제",
      variant: "danger",
    });
    if (!accepted) return;
    try {
      await deleteAttachment.mutateAsync({ id: attachment.id, path: attachment.fileUrl });
      appToast.success("계약서 사진을 삭제했습니다.");
    } catch (error) {
      appToast.error(error, "계약서 사진을 삭제하지 못했습니다.");
    }
  };

  const onBack = async () => {
    if (dirty) {
      const ok = await confirm({ title: "저장하지 않고 나가기", description: "저장하지 않고 나가시겠습니까?", confirmLabel: "나가기" });
      if (!ok) return;
    }
    router.push("/staff/buildings");
  };

  const title = buildingId ? state.name || "건물 상세" : "건물 등록";

  return (
    <div className="flex h-full flex-col">
      <RegisterHeader
        title={title}
        backLabel={buildingId ? "목록으로" : "뒤로가기"}
        saveLabel={buildingId ? "저장" : "등록 저장"}
        onBack={onBack}
        onSave={onSave}
        saving={isSavingBuilding}
      />
      {buildingId && fullLoading ? (
        <div role="status" aria-label="건물 정보 불러오는 중" className="min-h-[420px] p-[24px]">
          <p className="text-sm text-t3">건물 정보를 불러오는 중…</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-[16px] overflow-y-auto px-[24px] pb-[30px] pt-[22px]">
          <BasicInfoSection value={state} patch={patch} buildingTypeOptions={resolvers.typeLabels} />
          <VendorAssignmentSection
            value={state}
            patch={patch}
            staffOptions={resolvers.staffNames}
            showAllVendors={Boolean(buildingId)}
            attachments={vendorAttachments}
            onDeleteAttachment={onDeleteAttachment}
            disabled={isSavingBuilding}
          />
          <ReserveFundSection value={state} patch={patch} />
          <OwnerInfoSection value={state} patch={patch} />
          <ExtraInfoSection value={state} patch={patch} />
          <BuildingMemoSection value={state} patch={patch} />
        </div>
      )}
    </div>
  );
}
