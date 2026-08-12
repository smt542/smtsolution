// app/(staff)/staff/buildings/[id]/components/tenant-sections/MetersAccountsSection.tsx
"use client";
import React from "react";
import { Input } from "@/components/common";

export interface MeterRow { utility: "water" | "elec" | "gas"; meterNo: string; customerNo: string; }
export interface AccountRow { kind: "water" | "elec" | "gas" | "mgmt"; bank: string; account: string; holder: string; cmsMemberNo: string; }
export const METER_LABELS: Record<MeterRow["utility"], string> = { water: "수도", elec: "전기", gas: "가스" };
export const ACCOUNT_LABELS: Record<AccountRow["kind"], string> = { water: "수도", elec: "전기", gas: "가스", mgmt: "관리비" };

export function MetersAccountsSection({
  meters, accounts, onMeters, onAccounts,
}: {
  meters: MeterRow[]; accounts: AccountRow[];
  onMeters: (rows: MeterRow[]) => void; onAccounts: (rows: AccountRow[]) => void;
}) {
  const patchMeter = (utility: MeterRow["utility"], p: Partial<MeterRow>) =>
    onMeters(meters.map((m) => (m.utility === utility ? { ...m, ...p } : m)));
  const patchAccount = (kind: AccountRow["kind"], p: Partial<AccountRow>) =>
    onAccounts(accounts.map((a) => (a.kind === kind ? { ...a, ...p } : a)));

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-4 text-lg font-extrabold text-t1">계량기·계좌</h2>
      <h3 className="mb-2 text-sm font-bold text-t2">계량기</h3>
      <div className="mb-6 flex flex-col gap-2">
        {meters.map((m) => (
          <div key={m.utility} className="grid grid-cols-12 items-center gap-2">
            <span className="col-span-2 text-sm text-t2">{METER_LABELS[m.utility]}</span>
            <div className="col-span-5"><Input aria-label={`${METER_LABELS[m.utility]} 계량기번호`} placeholder="계량기번호" value={m.meterNo} onChange={(e) => patchMeter(m.utility, { meterNo: e.target.value })} /></div>
            <div className="col-span-5"><Input aria-label={`${METER_LABELS[m.utility]} 고객번호`} placeholder="고객번호" value={m.customerNo} onChange={(e) => patchMeter(m.utility, { customerNo: e.target.value })} /></div>
          </div>
        ))}
      </div>
      <h3 className="mb-2 text-sm font-bold text-t2">계좌</h3>
      <div className="flex flex-col gap-2">
        {accounts.map((a) => (
          <div key={a.kind} className="grid grid-cols-12 items-center gap-2">
            <span className="col-span-2 text-sm text-t2">{ACCOUNT_LABELS[a.kind]}</span>
            <div className="col-span-3"><Input aria-label={`${ACCOUNT_LABELS[a.kind]} 은행`} placeholder="은행" value={a.bank} onChange={(e) => patchAccount(a.kind, { bank: e.target.value })} /></div>
            <div className="col-span-3"><Input aria-label={`${ACCOUNT_LABELS[a.kind]} 계좌번호`} placeholder="계좌번호" value={a.account} onChange={(e) => patchAccount(a.kind, { account: e.target.value })} /></div>
            <div className="col-span-2"><Input aria-label={`${ACCOUNT_LABELS[a.kind]} 예금주`} placeholder="예금주" value={a.holder} onChange={(e) => patchAccount(a.kind, { holder: e.target.value })} /></div>
            <div className="col-span-2"><Input aria-label={`${ACCOUNT_LABELS[a.kind]} CMS`} placeholder="CMS회원번호" value={a.cmsMemberNo} onChange={(e) => patchAccount(a.kind, { cmsMemberNo: e.target.value })} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}
