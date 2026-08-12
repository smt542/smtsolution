// app/(staff)/staff/buildings/[id]/components/TenantForm.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/common";
import { useSaveUnitOccupancy, useUnitOccupancyFull, type SaveUnitOccupancyPayload } from "@/hooks/reactquery/occupancies";
import { useRoomTypes } from "@/hooks/reactquery/roomTypes";
import { occupancyBasicSchema } from "@/components/forms/schema/occupancy";
import { BasicInfoSection, type TenantBasicValue } from "./tenant-sections/BasicInfoSection";
import { BillingSettingsSection, type TenantBillingValue } from "./tenant-sections/BillingSettingsSection";
import { MetersAccountsSection, type MeterRow, type AccountRow } from "./tenant-sections/MetersAccountsSection";
import { LeaseSection, type TenantLeaseValue } from "./tenant-sections/LeaseSection";
import { FacilityNoteSection } from "./tenant-sections/FacilityNoteSection";

const emptyMeters = (): MeterRow[] => [
  { utility: "water", meterNo: "", customerNo: "" }, { utility: "elec", meterNo: "", customerNo: "" }, { utility: "gas", meterNo: "", customerNo: "" },
];
const emptyAccounts = (): AccountRow[] => [
  { kind: "water", bank: "", account: "", holder: "", cmsMemberNo: "" }, { kind: "elec", bank: "", account: "", holder: "", cmsMemberNo: "" },
  { kind: "gas", bank: "", account: "", holder: "", cmsMemberNo: "" }, { kind: "mgmt", bank: "", account: "", holder: "", cmsMemberNo: "" },
];

export function TenantForm({ buildingId, unitId }: { buildingId: number; unitId?: number }) {
  const router = useRouter();
  const save = useSaveUnitOccupancy();
  const { data: roomTypes } = useRoomTypes();
  const { data: full } = useUnitOccupancyFull(unitId ?? 0);

  const [basic, setBasic] = useState<TenantBasicValue>({ unitNo: "", tenantName: "", payerName: "", phone: "", phone2: "", phone3: "", vehicleNo: "", residentCount: null, roomTypeId: null, moveInDate: "" });
  const [billing, setBilling] = useState<TenantBillingValue>({ isVacant: false, moveOutDate: "", billingEnabled: true, printEnabled: true, lateFeeEnabled: true, singlePrint: false, billingNote: "", settlementNote: "" });
  const [meters, setMeters] = useState<MeterRow[]>(emptyMeters());
  const [accounts, setAccounts] = useState<AccountRow[]>(emptyAccounts());
  const [lease, setLease] = useState<TenantLeaseValue>({ deposit: null, monthlyRent: null, startDate: "", endDate: "", expiryAlert: false });
  const [facilityNote, setFacilityNote] = useState("");
  const [occupancyId, setOccupancyId] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof TenantBasicValue, string>>>({});

  const roomTypeOptions = useMemo(
    () => [{ value: "", label: "선택" }, ...(roomTypes ?? []).map((r) => ({ value: String(r.id), label: r.label }))],
    [roomTypes],
  );

  useEffect(() => {
    if (!full) return;
    const o = full.occupancy;
    setBasic({
      unitNo: full.unit.unitNo, tenantName: o?.tenantName ?? "", payerName: o?.payerName ?? "", phone: o?.phone ?? "",
      phone2: o?.phone2 ?? "", phone3: o?.phone3 ?? "", vehicleNo: o?.vehicleNo ?? "", residentCount: o?.residentCount ?? null,
      roomTypeId: o?.roomTypeId ?? null, moveInDate: o?.moveInDate ?? "",
    });
    setBilling({
      isVacant: o?.status === "vacant", moveOutDate: o?.moveOutDate ?? "",
      billingEnabled: o?.billingEnabled ?? true, printEnabled: o?.printEnabled ?? true,
      lateFeeEnabled: o?.lateFeeEnabled ?? true, singlePrint: o?.singlePrint ?? false,
      billingNote: o?.billingNote ?? "", settlementNote: o?.settlementNote ?? "",
    });
    setFacilityNote(o?.facilityNote ?? "");
    setOccupancyId(o?.id ?? null);
    setMeters(emptyMeters().map((m) => { const f = full.meters.find((x) => x.utility === m.utility); return f ? { utility: m.utility, meterNo: f.meterNo ?? "", customerNo: f.customerNo ?? "" } : m; }));
    setAccounts(emptyAccounts().map((a) => { const f = full.accounts.find((x) => x.kind === a.kind); return f ? { kind: a.kind, bank: f.bank ?? "", account: f.account ?? "", holder: f.holder ?? "", cmsMemberNo: f.cmsMemberNo ?? "" } : a; }));
    setLease(full.lease ? { deposit: full.lease.deposit, monthlyRent: full.lease.monthlyRent, startDate: full.lease.startDate ?? "", endDate: full.lease.endDate ?? "", expiryAlert: full.lease.expiryAlert } : { deposit: null, monthlyRent: null, startDate: "", endDate: "", expiryAlert: false });
    setDirty(false);
  }, [full]);

  const mark = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };
  const patchBasic = (p: Partial<TenantBasicValue>) => { setBasic((b) => ({ ...b, ...p })); setDirty(true); };
  const patchBilling = (p: Partial<TenantBillingValue>) => { setBilling((b) => ({ ...b, ...p })); setDirty(true); };

  const onSave = async () => {
    const parsed = occupancyBasicSchema.safeParse({
      unitNo: basic.unitNo, tenantName: basic.tenantName, payerName: basic.payerName, phone: basic.phone,
      phone2: basic.phone2, phone3: basic.phone3, vehicleNo: basic.vehicleNo, residentCount: basic.residentCount,
      roomTypeId: basic.roomTypeId ?? 0, moveInDate: basic.moveInDate,
    });
    if (!parsed.success) {
      const fe: Partial<Record<keyof TenantBasicValue, string>> = {};
      for (const issue of parsed.error.issues) { const k = issue.path[0] as keyof TenantBasicValue; if (!fe[k]) fe[k] = issue.message; }
      setErrors(fe); toast.error("필수 항목을 확인해 주세요."); return;
    }
    setErrors({});
    const payload: SaveUnitOccupancyPayload = {
      buildingId, unitId: unitId ?? null, occupancyId,
      unit: { unitNo: basic.unitNo },
      occupancy: {
        tenantName: basic.tenantName, payerName: basic.payerName, phone: basic.phone, phone2: basic.phone2, phone3: basic.phone3,
        vehicleNo: basic.vehicleNo, residentCount: basic.residentCount, roomTypeId: basic.roomTypeId, moveInDate: basic.moveInDate,
        moveOutDate: billing.moveOutDate || null, status: billing.isVacant ? "vacant" : "occupied",
        billingEnabled: billing.billingEnabled, printEnabled: billing.printEnabled, lateFeeEnabled: billing.lateFeeEnabled,
        singlePrint: billing.singlePrint, billingNote: billing.billingNote, settlementNote: billing.settlementNote, facilityNote,
      },
      meters, accounts,
      lease: { deposit: lease.deposit, monthlyRent: lease.monthlyRent, startDate: lease.startDate || null, endDate: lease.endDate || null, expiryAlert: lease.expiryAlert },
    };
    try {
      const res = await save.mutateAsync(payload);
      toast.success("저장되었습니다."); setDirty(false);
      if (!unitId) router.replace(`/staff/buildings/${buildingId}/tenants/${res.unitId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
    }
  };

  const onLeave = () => {
    if (dirty && !window.confirm("저장하지 않고 나가시겠습니까?")) return;
    router.push(`/staff/buildings/${buildingId}/tenants`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-t1">{unitId ? `${basic.unitNo} · ${basic.tenantName || "입주자"}` : "입주자 등록"}</h2>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onLeave}>목록으로</Button>
          <Button variant="primary" onClick={onSave} disabled={save.isPending}>저장</Button>
        </div>
      </div>
      <BasicInfoSection value={basic} onChange={patchBasic} roomTypeOptions={roomTypeOptions} errors={errors} />
      <BillingSettingsSection value={billing} onChange={patchBilling} />
      <MetersAccountsSection meters={meters} accounts={accounts} onMeters={mark(setMeters)} onAccounts={mark(setAccounts)} />
      <LeaseSection value={lease} onChange={mark((v: Partial<TenantLeaseValue>) => setLease((l) => ({ ...l, ...v })))} history={full?.history ?? []} />
      <FacilityNoteSection value={facilityNote} onChange={mark(setFacilityNote)} />
    </div>
  );
}
