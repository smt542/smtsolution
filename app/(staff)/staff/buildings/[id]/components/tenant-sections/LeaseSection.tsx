// app/(staff)/staff/buildings/[id]/components/tenant-sections/LeaseSection.tsx
"use client";
import React from "react";
import { Input, Checkbox } from "@/components/common";
import type { OccupancyHistory } from "@/hooks/reactquery/occupancyHistory";

export interface TenantLeaseValue { deposit: number | null; monthlyRent: number | null; startDate: string; endDate: string; expiryAlert: boolean; }

export function LeaseSection({ value, onChange, history }: { value: TenantLeaseValue; onChange: (patch: Partial<TenantLeaseValue>) => void; history: OccupancyHistory[] }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-4 text-lg font-extrabold text-t1">임대차 정보</h2>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1"><span className="text-sm text-t2">보증금</span>
          <Input aria-label="보증금" type="number" min={0} value={value.deposit ?? ""} onChange={(e) => onChange({ deposit: e.target.value ? Number(e.target.value) : null })} /></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-t2">월세</span>
          <Input aria-label="월세" type="number" min={0} value={value.monthlyRent ?? ""} onChange={(e) => onChange({ monthlyRent: e.target.value ? Number(e.target.value) : null })} /></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-t2">계약 시작일</span>
          <Input aria-label="계약 시작일" type="date" value={value.startDate} onChange={(e) => onChange({ startDate: e.target.value })} /></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-t2">계약 종료일</span>
          <Input aria-label="계약 종료일" type="date" value={value.endDate} onChange={(e) => onChange({ endDate: e.target.value })} /></label>
        <Checkbox label="계약 만료 알림" checked={value.expiryAlert} onChange={(e) => onChange({ expiryAlert: e.target.checked })} />
      </div>
      <div className="mt-6">
        <h3 className="mb-2 text-sm font-bold text-t2">이전 전출자 이력</h3>
        {history.length === 0 ? (
          <p className="text-sm text-t4">전출자 이력이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 rounded-xl border border-line p-2 text-sm text-t2">
                <span className="flex-1">{h.tenantName ?? "-"}</span>
                <span className="text-t3">{h.moveInDate ?? "-"} ~ {h.moveOutDate ?? "-"}</span>
                <span className="text-t3">{h.roomTypeLabel ?? "-"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
