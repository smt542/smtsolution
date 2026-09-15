"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Button } from "@/components/common";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { useMe } from "@/hooks/reactquery/auth";
import {
  useSaveBuilding, useStaffOptions, useBuildingFull, useSetBuildingSetupConfirm,
  emptyFacilities, type FacilitiesMap, type SaveBuildingPayload,
} from "@/hooks/reactquery/buildings";
import { uploadAttachment, deleteAttachment, listAttachmentsByEntities, attachmentSignedUrl } from "@/hooks/reactquery/attachments";
import { buildingBasicSchema } from "@/components/forms/schema/building";
import { customerNumberSchema } from "@/components/forms/schema/buildingCustomerNumber";
import { buildingVendorSchema } from "@/components/forms/schema/buildingVendor";
import { BasicInfoSection, type BasicInfoValue } from "./sections/BasicInfoSection";
import { FacilitiesSection } from "./sections/FacilitiesSection";
import { CustomerNumberSection, type CustomerRow } from "./sections/CustomerNumberSection";
import { VendorSection, type VendorRow } from "./sections/VendorSection";
import { MemoSection } from "./sections/MemoSection";

let keySeq = 0;
const rowKey = (p: string) => `${p}-${keySeq++}`;

export function BuildingForm({ buildingId }: { buildingId?: number }) {
  const confirm = useConfirm();
  const router = useRouter();
  const { data: me } = useMe();
  const save = useSaveBuilding();
  const setConfirmFlag = useSetBuildingSetupConfirm();
  const { data: staff } = useStaffOptions();
  const { data: full } = useBuildingFull(buildingId ?? 0);

  const [basic, setBasic] = useState<BasicInfoValue>({ code: "", name: "", address: "", managerUserId: null, meterUserId: null, cleaningUserId: null });
  const [facilities, setFacilities] = useState<FacilitiesMap>(emptyFacilities());
  const [customerNumbers, setCustomerNumbers] = useState<CustomerRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [memo, setMemo] = useState("");
  const [setupConfirmRequired, setSetupConfirmRequired] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof BasicInfoValue, string>>>({});

  const staffOptions = useMemo(
    () => [{ value: "", label: "미지정" }, ...(staff ?? []).map((s) => ({ value: s.userId, label: s.fullName }))],
    [staff],
  );

  // 수정 모드: 로드된 데이터 → 폼 상태
  useEffect(() => {
    if (!full) return;
    setBasic.call(undefined, {
      code: full.code, name: full.name, address: full.address ?? "",
      managerUserId: full.managerUserId, meterUserId: full.meterUserId, cleaningUserId: full.cleaningUserId,
    });
    setFacilities.call(undefined, full.facilities);
    setMemo.call(undefined, full.memo ?? "");
    setSetupConfirmRequired.call(undefined, full.setupConfirmRequired);
    setCustomerNumbers.call(undefined, full.customerNumbers.map((c) => ({
      _key: rowKey("cn"), id: c.id, kind: c.kind, customerNo: c.customerNo, meterDay: c.meterDay,
      billingBasis: c.billingBasis, printOnBill: c.printOnBill, holderName: c.holderName ?? "",
      lineName: c.lineName ?? "", calculationMethod: c.calculationMethod, note: c.note ?? "",
    })));
    const vendorIds = full.vendors.map((v) => v.id);
    (async () => {
      const atts = await listAttachmentsByEntities("building_vendor", vendorIds);
      setVendors.call(undefined, full.vendors.map((v) => ({
        _key: rowKey("vn"), id: v.id, vendorType: v.vendorType, name: v.name,
        phone: v.phone ?? "", memo: v.memo ?? "", pendingFiles: [],
        existing: atts.filter((a) => a.entityId === v.id).map((a) => ({ id: a.id, path: a.fileUrl, name: a.fileName })),
      })));
    })();
    setDirty.call(undefined, false);
  }, [full]);

  const mark = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };
  const patchBasic = (p: Partial<BasicInfoValue>) => { setBasic((b) => ({ ...b, ...p })); setDirty(true); };

  const validate = (): boolean => {
    const b = buildingBasicSchema.safeParse({ ...basic, memo });
    if (!b.success) {
      const fe: Partial<Record<keyof BasicInfoValue, string>> = {};
      for (const issue of b.error.issues) {
        const k = issue.path[0] as keyof BasicInfoValue;
        if (!fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      toast.error("필수 항목을 확인해 주세요.");
      return false;
    }
    setErrors({});
    for (const c of customerNumbers.filter((r) => !r._deleted)) {
      if (!customerNumberSchema.safeParse({ ...c, meterDay: c.meterDay ?? undefined }).success) {
        toast.error("고객번호 입력을 확인해 주세요."); return false;
      }
    }
    for (const v of vendors.filter((r) => !r._deleted)) {
      if (!buildingVendorSchema.safeParse(v).success) {
        toast.error("협력업체 입력을 확인해 주세요."); return false;
      }
    }
    return true;
  };

  const onSave = async () => {
    if (!me) return;
    if (!validate()) return;
    const payload: SaveBuildingPayload = {
      id: buildingId ?? null,
      code: basic.code || undefined,
      name: basic.name,
      address: basic.address,
      managerUserId: basic.managerUserId,
      meterUserId: basic.meterUserId,
      cleaningUserId: basic.cleaningUserId,
      facilities,
      memo,
      customerNumbers: customerNumbers.map((c, i) => ({
        id: c.id, kind: c.kind, customerNo: c.customerNo, meterDay: c.meterDay,
        billingBasis: c.billingBasis, printOnBill: c.printOnBill, holderName: c.holderName,
        lineName: c.lineName, calculationMethod: c.calculationMethod, note: c.note,
        sortOrder: i, _deleted: c._deleted,
      })),
      vendors: vendors.map((v, i) => ({
        id: v.id, clientKey: v.id ? undefined : v._key, vendorType: v.vendorType, name: v.name,
        phone: v.phone, memo: v.memo, sortOrder: i, _deleted: v._deleted,
      })),
    };
    try {
      const res = await save.mutateAsync(payload);
      // §3.4 관리비 셋팅 확인 플래그: 변경분만 별도 RPC로 저장(shared save_building 미변경)
      if (setupConfirmRequired !== (full?.setupConfirmRequired ?? false)) {
        await setConfirmFlag.mutateAsync({ id: res.buildingId, required: setupConfirmRequired });
      }
      // 파일 후속 업로드: 신규 업체는 clientKey→id, 기존 업체는 v.id
      const keyToId = new Map(res.vendors.map((x) => [x.clientKey, x.id]));
      for (const v of vendors) {
        if (v._deleted || v.pendingFiles.length === 0) continue;
        const vid = v.id ?? keyToId.get(v._key);
        if (!vid) continue;
        for (const file of v.pendingFiles) {
          await uploadAttachment({ entityType: "building_vendor", entityId: vid, orgId: me.orgId, kind: "contract", file });
        }
      }
      toast.success("저장되었습니다.");
      setDirty(false);
      if (buildingId) router.refresh?.();
      else router.replace(`/staff/buildings/${res.buildingId}`);
    } catch (e) {
      toast.error(e, "저장에 실패했습니다.");
    }
  };

  const onDeleteExisting = async (attId: number, path: string) => {
    const accepted = await confirm({
      title: "계약서 사진 삭제",
      description: "저장된 계약서 사진을 삭제할까요?",
      confirmLabel: "삭제",
      variant: "danger",
    });
    if (!accepted) return;
    try {
      await deleteAttachment({ id: attId, path });
      setVendors((rows) => rows.map((r) => ({ ...r, existing: r.existing.filter((f) => f.id !== attId) })));
    } catch (e) {
      toast.error(e, "파일 삭제에 실패했습니다.");
    }
  };

  const onViewExisting = async (path: string) => {
    try {
      const url = await attachmentSignedUrl(path, { preset: "original" });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e, "파일을 열 수 없습니다.");
    }
  };

  const onLeave = async () => {
    if (dirty) {
      const ok = await confirm({ title: "저장하지 않고 나가기", description: "저장하지 않고 나가시겠습니까?", confirmLabel: "나가기" });
      if (!ok) return;
    }
    router.push("/staff/buildings");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-t1">
          {buildingId ? `건물 상세 — ${basic.name}` : "건물 등록"}
        </h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onLeave}>목록으로</Button>
          <Button variant="primary" onClick={onSave} disabled={save.isPending}>저장</Button>
        </div>
      </div>
      <BasicInfoSection value={basic} onChange={patchBasic} staffOptions={staffOptions} errors={errors} />
      <FacilitiesSection value={facilities} onChange={mark(setFacilities)} />
      <CustomerNumberSection rows={customerNumbers} onChange={mark(setCustomerNumbers)} />
      <VendorSection rows={vendors} onChange={mark(setVendors)} onDeleteExisting={onDeleteExisting} onViewExisting={onViewExisting} disabled={save.isPending} />
      <MemoSection value={memo} onChange={mark(setMemo)} />
      <label className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-4 text-sm font-semibold text-t1 shadow-card">
        <input
          type="checkbox"
          checked={setupConfirmRequired}
          onChange={(e) => { setSetupConfirmRequired(e.target.checked); setDirty(true); }}
          className="h-4 w-4"
        />
        관리비 셋팅 시 확인 필요
      </label>
    </div>
  );
}
