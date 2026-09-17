"use client";
import React from "react";
import { Checkbox, Select, Textarea } from "@/components/common";
import type { TransferMethod } from "@/hooks/reactquery/occupancies";
import { transferMethodOptions } from "@/lib/bill/transferMethod";

export interface TenantBillingValue {
  billingEnabled: boolean;
  lateFeeEnabled: boolean;
  singlePrint: boolean;
  transferMethod: TransferMethod;
  billingNote: string;
  settlementNote: string;
}

export function BillingSettingsSection({ value, onChange }: {
  value: TenantBillingValue;
  onChange: (patch: Partial<TenantBillingValue>) => void;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-4 text-lg font-extrabold text-t1">관리비·부과</h2>
      <div className="grid grid-cols-2 gap-4">
        <Checkbox label="부과금 여부" checked={value.billingEnabled} onChange={(e) => onChange({ billingEnabled: e.target.checked })} />
        <Checkbox label="연체료 부과 여부" checked={value.lateFeeEnabled} onChange={(e) => onChange({ lateFeeEnabled: e.target.checked })} />
        <Checkbox label="단수 출력 여부" checked={value.singlePrint} onChange={(e) => onChange({ singlePrint: e.target.checked })} />
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">이체 방식</span>
          <Select
            aria-label="이체 방식"
            options={transferMethodOptions}
            value={value.transferMethod}
            onChange={(e) => onChange({ transferMethod: e.target.value as TransferMethod })}
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-sm text-t2">적요</span>
          <Textarea aria-label="적요" className="min-h-20 px-[12px]" value={value.billingNote} onChange={(e) => onChange({ billingNote: e.target.value })} />
        </label>
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-sm text-t2">이사정산 시 적요</span>
          <Textarea aria-label="이사정산 적요" className="min-h-20 px-[12px]" value={value.settlementNote} onChange={(e) => onChange({ settlementNote: e.target.value })} />
        </label>
      </div>
    </section>
  );
}
