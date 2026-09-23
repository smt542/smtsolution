// app/(staff)/staff/buildings/[id]/components/tenant-sections/LeaseSection.tsx
"use client";
import React from "react";
import { Input, Checkbox } from "@/components/common";
import { DateInput } from "@/components/common/DateInput";

export interface TenantLeaseValue { deposit: number | null; monthlyRent: number | null; startDate: string; endDate: string; expiryAlert: boolean; }

export function LeaseSection({ value, onChange }: { value: TenantLeaseValue; onChange: (patch: Partial<TenantLeaseValue>) => void }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-4 text-lg font-extrabold text-t1">임대차 정보</h2>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1"><span className="text-sm text-t2">보증금</span>
          <Input aria-label="보증금" type="number" min={0} value={value.deposit ?? ""} onChange={(e) => onChange({ deposit: e.target.value ? Number(e.target.value) : null })} /></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-t2">월세</span>
          <Input aria-label="월세" type="number" min={0} value={value.monthlyRent ?? ""} onChange={(e) => onChange({ monthlyRent: e.target.value ? Number(e.target.value) : null })} /></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-t2">계약 시작일</span>
          <DateInput ariaLabel="계약 시작일" value={value.startDate} onChange={(nextValue) => onChange({ startDate: nextValue })} /></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-t2">계약 종료일</span>
          <DateInput ariaLabel="계약 종료일" value={value.endDate} onChange={(nextValue) => onChange({ endDate: nextValue })} /></label>
        <Checkbox label="계약 만료 알림" checked={value.expiryAlert} onChange={(e) => onChange({ expiryAlert: e.target.checked })} />
      </div>
    </section>
  );
}
