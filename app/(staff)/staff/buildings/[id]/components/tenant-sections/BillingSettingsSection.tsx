"use client";
import React from "react";
import { Checkbox, Input } from "@/components/common";

export interface TenantBillingValue {
  isVacant: boolean; moveOutDate: string;
  billingEnabled: boolean; printEnabled: boolean; lateFeeEnabled: boolean; singlePrint: boolean;
  billingNote: string; settlementNote: string;
}
export function BillingSettingsSection({ value, onChange }: { value: TenantBillingValue; onChange: (patch: Partial<TenantBillingValue>) => void }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-4 text-lg font-extrabold text-t1">부과·출력 설정</h2>
      <div className="grid grid-cols-2 gap-4">
        <Checkbox label="부과 설정" checked={value.billingEnabled} onChange={(e) => onChange({ billingEnabled: e.target.checked })} />
        <Checkbox label="출력 설정" checked={value.printEnabled} onChange={(e) => onChange({ printEnabled: e.target.checked })} />
        <Checkbox label="공실 처리" checked={value.isVacant} onChange={(e) => onChange({ isVacant: e.target.checked })} />
        <Checkbox label="연체료 부과" checked={value.lateFeeEnabled} onChange={(e) => onChange({ lateFeeEnabled: e.target.checked })} />
        <Checkbox label="단수 출력" checked={value.singlePrint} onChange={(e) => onChange({ singlePrint: e.target.checked })} />
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">퇴실일자</span>
          <Input aria-label="퇴실일자" type="date" value={value.moveOutDate} onChange={(e) => onChange({ moveOutDate: e.target.value })} />
        </label>
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-sm text-t2">적요</span>
          <textarea aria-label="적요" className="min-h-20 w-full rounded-xl border border-line bg-surface p-3 text-sm text-t1 focus:border-brand focus:outline-none" value={value.billingNote} onChange={(e) => onChange({ billingNote: e.target.value })} />
        </label>
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-sm text-t2">이사정산 시 적요</span>
          <textarea aria-label="이사정산 적요" className="min-h-20 w-full rounded-xl border border-line bg-surface p-3 text-sm text-t1 focus:border-brand focus:outline-none" value={value.settlementNote} onChange={(e) => onChange({ settlementNote: e.target.value })} />
        </label>
      </div>
    </section>
  );
}
