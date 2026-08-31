"use client";

import { Button, Checkbox, Input, Select } from "@/components/common";
import type { CustomerNumberCalculationMethod } from "@/hooks/reactquery/buildingCustomerNumbers";

export interface CustomerRow {
  _key: string;
  id?: number;
  kind: "water" | "common_elec" | "elec" | "gas";
  customerNo: string;
  lineName: string;
  meterDay: number | null;
  billingBasis: "prev" | "current";
  calculationMethod: CustomerNumberCalculationMethod;
  note: string;
  printOnBill: boolean;
  holderName: string;
  _deleted?: boolean;
}

export const KIND_LABELS: Record<CustomerRow["kind"], string> = {
  water: "수도",
  common_elec: "공용전기",
  elec: "전기",
  gas: "가스",
};

const KIND_OPTIONS = (Object.keys(KIND_LABELS) as CustomerRow["kind"][]).map((kind) => ({
  value: kind,
  label: KIND_LABELS[kind],
}));
const BASIS_OPTIONS = [
  { value: "prev", label: "전월" },
  { value: "current", label: "당월" },
];
const CALCULATION_OPTIONS = [
  { value: "auto", label: "자동" },
  { value: "manual", label: "수동" },
];

let sequence = 0;
const newKey = () => `cn-new-${sequence++}`;

export function CustomerNumberSection({
  rows,
  onChange,
}: {
  rows: CustomerRow[];
  onChange: (rows: CustomerRow[]) => void;
}) {
  const visibleRows = rows.filter((row) => !row._deleted);
  const patch = (key: string, value: Partial<CustomerRow>) =>
    onChange(rows.map((row) => (row._key === key ? { ...row, ...value } : row)));
  const add = () =>
    onChange([
      ...rows,
      {
        _key: newKey(),
        kind: "water",
        customerNo: "",
        lineName: "",
        meterDay: null,
        billingBasis: "current",
        calculationMethod: "auto",
        note: "",
        printOnBill: true,
        holderName: "",
      },
    ]);
  const remove = (key: string) => {
    const row = rows.find((item) => item._key === key);
    if (row?.id) {
      onChange(rows.map((item) => (item._key === key ? { ...item, _deleted: true } : item)));
      return;
    }
    onChange(rows.filter((item) => item._key !== key));
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-t1">고객번호</h2>
        <Button type="button" variant="ghost" onClick={add}>+ 고객번호 추가</Button>
      </div>
      {visibleRows.length === 0 ? (
        <p className="text-sm text-t4">등록된 고객번호가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleRows.map((row) => (
            <div key={row._key} className="rounded-xl border border-line2 bg-bg/40 p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                <Select
                  aria-label="유형"
                  className="md:col-span-2"
                  options={KIND_OPTIONS}
                  value={row.kind}
                  onChange={(event) => {
                    const kind = event.target.value as CustomerRow["kind"];
                    patch(row._key, {
                      kind,
                      calculationMethod: kind === "common_elec" ? "auto" : row.calculationMethod,
                    });
                  }}
                />
                <Input
                  aria-label="고객번호"
                  className="md:col-span-3"
                  value={row.customerNo}
                  onChange={(event) => patch(row._key, { customerNo: event.target.value })}
                  placeholder="고객번호"
                />
                <Input
                  aria-label="LIN"
                  className="md:col-span-1"
                  value={row.lineName}
                  onChange={(event) => patch(row._key, { lineName: event.target.value })}
                  placeholder="LIN"
                />
                <Input
                  aria-label="일금일"
                  className="md:col-span-1"
                  type="number"
                  min={1}
                  max={28}
                  value={row.meterDay ?? ""}
                  onChange={(event) => patch(row._key, {
                    meterDay: event.target.value ? Number(event.target.value) : null,
                  })}
                  placeholder="1~28"
                />
                <Select
                  aria-label="구분"
                  className="md:col-span-2"
                  options={BASIS_OPTIONS}
                  value={row.billingBasis}
                  onChange={(event) => patch(row._key, {
                    billingBasis: event.target.value as CustomerRow["billingBasis"],
                  })}
                />
                <Select
                  aria-label="계산"
                  className="md:col-span-2"
                  options={CALCULATION_OPTIONS}
                  value={row.kind === "common_elec" ? "auto" : row.calculationMethod}
                  disabled={row.kind === "common_elec"}
                  onChange={(event) => patch(row._key, {
                    calculationMethod: event.target.value as CustomerNumberCalculationMethod,
                  })}
                />
                <div className="flex items-center md:col-span-1">
                  <Checkbox
                    label="출력"
                    checked={row.printOnBill}
                    onChange={(event) => patch(row._key, { printOnBill: event.target.checked })}
                  />
                </div>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-12">
                <Input
                  aria-label="명의자"
                  className="md:col-span-3"
                  value={row.holderName}
                  onChange={(event) => patch(row._key, { holderName: event.target.value })}
                  placeholder="명의자"
                />
                <Input
                  aria-label="기타적요"
                  className="md:col-span-8"
                  value={row.note}
                  onChange={(event) => patch(row._key, { note: event.target.value })}
                  placeholder="기타적요"
                />
                <Button type="button" variant="danger" className="md:col-span-1" onClick={() => remove(row._key)}>
                  삭제
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
