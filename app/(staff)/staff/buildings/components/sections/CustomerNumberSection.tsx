"use client";
import React from "react";
import { Input, Select, Checkbox, Button } from "@/components/common";

export interface CustomerRow {
  _key: string;
  id?: number;
  kind: "water" | "common_elec" | "elec" | "gas";
  customerNo: string;
  meterDay: number | null;
  billingBasis: "prev" | "current";
  printOnBill: boolean;
  holderName: string;
  _deleted?: boolean;
}
export const KIND_LABELS: Record<CustomerRow["kind"], string> = {
  water: "수도", common_elec: "공용전기", elec: "전기", gas: "가스",
};
const KIND_OPTS = (Object.keys(KIND_LABELS) as CustomerRow["kind"][]).map((k) => ({ value: k, label: KIND_LABELS[k] }));
const BASIS_OPTS = [{ value: "prev", label: "전월" }, { value: "current", label: "당월" }];

let seq = 0;
const newKey = () => `cn-new-${seq++}`;

export function CustomerNumberSection({
  rows, onChange,
}: {
  rows: CustomerRow[];
  onChange: (rows: CustomerRow[]) => void;
}) {
  const visible = rows.filter((r) => !r._deleted);
  const patch = (key: string, p: Partial<CustomerRow>) =>
    onChange(rows.map((r) => (r._key === key ? { ...r, ...p } : r)));
  const add = () =>
    onChange([...rows, { _key: newKey(), kind: "water", customerNo: "", meterDay: null, billingBasis: "current", printOnBill: true, holderName: "" }]);
  const remove = (key: string) => {
    const row = rows.find((r) => r._key === key);
    if (row?.id) onChange(rows.map((r) => (r._key === key ? { ...r, _deleted: true } : r)));
    else onChange(rows.filter((r) => r._key !== key));
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-t1">고객번호</h2>
        <Button variant="ghost" onClick={add}>+ 고객번호 추가</Button>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-t4">등록된 고객번호가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((r) => (
            <div key={r._key} className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-2"><Select aria-label="유형" options={KIND_OPTS} value={r.kind} onChange={(e) => patch(r._key, { kind: e.target.value as CustomerRow["kind"] })} /></div>
              <div className="col-span-3"><Input aria-label="고객번호" value={r.customerNo} onChange={(e) => patch(r._key, { customerNo: e.target.value })} placeholder="고객번호" /></div>
              <div className="col-span-2"><Input aria-label="검침일" type="number" min={1} max={31} value={r.meterDay ?? ""} onChange={(e) => patch(r._key, { meterDay: e.target.value ? Number(e.target.value) : null })} placeholder="매월 N일" /></div>
              <div className="col-span-2"><Select aria-label="부과기간" options={BASIS_OPTS} value={r.billingBasis} onChange={(e) => patch(r._key, { billingBasis: e.target.value as CustomerRow["billingBasis"] })} /></div>
              <div className="col-span-1"><Checkbox label="출력" checked={r.printOnBill} onChange={(e) => patch(r._key, { printOnBill: e.target.checked })} /></div>
              <div className="col-span-1"><Input aria-label="명의자" value={r.holderName} onChange={(e) => patch(r._key, { holderName: e.target.value })} placeholder="명의자" /></div>
              <div className="col-span-1"><Button variant="danger" onClick={() => remove(r._key)}>삭제</Button></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
