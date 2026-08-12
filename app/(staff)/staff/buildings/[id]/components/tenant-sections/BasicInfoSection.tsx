"use client";
import React from "react";
import { Input, Select } from "@/components/common";

export interface TenantBasicValue {
  unitNo: string; tenantName: string; payerName: string; phone: string; phone2: string; phone3: string;
  vehicleNo: string; residentCount: number | null; roomTypeId: number | null; moveInDate: string;
}
type Opt = { value: string; label: string };

export function BasicInfoSection({
  value, onChange, roomTypeOptions, errors,
}: {
  value: TenantBasicValue;
  onChange: (patch: Partial<TenantBasicValue>) => void;
  roomTypeOptions: Opt[];
  errors?: Partial<Record<keyof TenantBasicValue, string>>;
}) {
  const field = (label: string, key: keyof TenantBasicValue, required = false) => (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-t2">{label}{required ? " *" : ""}</span>
      <Input aria-label={label} value={(value[key] as string) ?? ""} onChange={(e) => onChange({ [key]: e.target.value } as Partial<TenantBasicValue>)} />
      {errors?.[key] && <span className="text-xs text-danger">{errors[key]}</span>}
    </label>
  );
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-4 text-lg font-extrabold text-t1">기본 정보</h2>
      <div className="grid grid-cols-2 gap-4">
        {field("호실명", "unitNo", true)}
        {field("이름", "tenantName", true)}
        {field("입금자명", "payerName", true)}
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">룸타입 *</span>
          <Select aria-label="룸타입" options={roomTypeOptions} value={value.roomTypeId != null ? String(value.roomTypeId) : ""}
            onChange={(e) => onChange({ roomTypeId: e.target.value ? Number(e.target.value) : null })} />
          {errors?.roomTypeId && <span className="text-xs text-danger">{errors.roomTypeId}</span>}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">인원</span>
          <Input aria-label="인원" type="number" min={0} value={value.residentCount ?? ""} onChange={(e) => onChange({ residentCount: e.target.value ? Number(e.target.value) : null })} />
        </label>
        {field("연락처1", "phone", true)}
        {field("연락처2", "phone2")}
        {field("연락처3", "phone3")}
        {field("차량번호", "vehicleNo")}
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">입주일 *</span>
          <Input aria-label="입주일" type="date" value={value.moveInDate} onChange={(e) => onChange({ moveInDate: e.target.value })} />
          {errors?.moveInDate && <span className="text-xs text-danger">{errors.moveInDate}</span>}
        </label>
      </div>
    </section>
  );
}
