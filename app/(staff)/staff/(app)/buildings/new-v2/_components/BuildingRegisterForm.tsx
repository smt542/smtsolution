"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/common/ConfirmProvider";
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
  const router = useRouter();
  const save = useSaveBuilding();
  const { data: staff } = useStaffOptions();
  const { data: types } = useBuildingTypes();
  const { data: full, isLoading: fullLoading } = useBuildingFull(buildingId ?? 0);

  const [state, setState] = useState<RegisterFormState>(initialFormState);
  const [dirty, setDirty] = useState(false);
  const [hydratedFor, setHydratedFor] = useState<number | null>(null);

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
    if (!state.name.trim()) {
      toast.error("건물명을 입력해 주세요.");
      return;
    }
    if (!state.address.trim()) {
      toast.error("주소를 입력해 주세요.");
      return;
    }
    const payload = formStateToPayload(state, {
      id: buildingId ?? null,
      resolveStaffId: resolvers.resolveStaffId,
      resolveTypeId: resolvers.resolveTypeId,
      carry: { cleaningUserId: full?.cleaningUserId ?? null, facilities: full?.facilities ?? null },
    });
    try {
      const res = await save.mutateAsync(payload);
      toast.success("저장되었습니다.");
      setDirty(false);
      if (buildingId) router.refresh();
      else router.replace(`/staff/buildings/${res.buildingId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
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
        saving={save.isPending}
      />
      {buildingId && fullLoading ? (
        <div className="p-[24px]">
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
