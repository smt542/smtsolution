"use client";
import React from "react";
import { Checkbox, Select } from "@/components/common";
import type { BillDelivery, BillNameDisplay } from "@/hooks/reactquery/occupancies";

export interface TenantBillValue {
  printEnabled: boolean;
  billNameDisplay: BillNameDisplay;
  billDelivery: BillDelivery;
  billAuth: boolean;
}

const nameDisplayOptions = [
  { value: "none", label: "미출력" },
  { value: "name", label: "이름 출력" },
  { value: "code", label: "코드번호 출력" },
];

const deliveryOptions = [
  { value: "post", label: "우편" },
  { value: "alimtalk", label: "알림톡 고지서" },
];

export function BillStatementSection({ value, onChange }: {
  value: TenantBillValue;
  onChange: (patch: Partial<TenantBillValue>) => void;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-4 text-lg font-extrabold text-t1">고지서</h2>
      <div className="grid grid-cols-2 gap-4">
        <Checkbox label="출력 여부" checked={value.printEnabled} onChange={(e) => onChange({ printEnabled: e.target.checked })} />
        <Checkbox label="인증" checked={value.billAuth} onChange={(e) => onChange({ billAuth: e.target.checked })} />
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">이름 출력 유형</span>
          <Select
            aria-label="이름 출력 유형"
            options={nameDisplayOptions}
            value={value.billNameDisplay}
            onChange={(e) => onChange({ billNameDisplay: e.target.value as BillNameDisplay })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">발송</span>
          <Select
            aria-label="고지서 발송"
            options={deliveryOptions}
            value={value.billDelivery}
            onChange={(e) => onChange({ billDelivery: e.target.value as BillDelivery })}
          />
        </label>
      </div>
      {/* 발송 화면에서도 유지해야 할 정책: 알림톡 수신 동의 세대는 이체 방식과 무관하게 알림톡 고지서로 발송한다. */}
      <p className="mt-4 rounded-xl bg-blue-t2 px-4 py-3 text-xs text-t2">
        알림톡 수신 동의 세대는 이체 방식과 무관하게 알림톡 고지서로 발송됩니다.
      </p>
    </section>
  );
}
