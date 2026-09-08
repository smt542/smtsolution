"use client";

import { useState } from "react";
import type { UtilityConfirmation, UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";

type UtilityTab = "water" | "electricity" | "common-electricity" | "gas";

interface UtilitySummaryPanelProps {
  buildingSelected: boolean;
  rows: Record<"water" | "electricity" | "gas", UtilityUnitRow[]>;
  confirmations: Record<"water" | "electricity" | "gas", UtilityConfirmation | null>;
  loading: Record<"water" | "electricity" | "gas", boolean>;
}

const tabs: { key: UtilityTab; label: string }[] = [
  { key: "water", label: "수도" },
  { key: "electricity", label: "전기" },
  { key: "common-electricity", label: "공용전기" },
  { key: "gas", label: "가스" },
];

const headers = [
  "L",
  "고객번호",
  "월",
  "량",
  "수동입력",
  "할인금액",
  "전월금액",
  "부과액",
  "전단가",
  "단가",
  "금-전1",
  "금-전2",
  "금월량",
  "전월량",
];

const total = (rows: UtilityUnitRow[], value: (row: UtilityUnitRow) => number | null) =>
  rows.reduce((sum, row) => sum + (value(row) ?? 0), 0);

const numberOrDash = (value: number | null | undefined) =>
  value == null ? "-" : formatNumber(value);

export function UtilitySummaryPanel({
  buildingSelected,
  rows,
  confirmations,
  loading,
}: UtilitySummaryPanelProps) {
  const [activeTab, setActiveTab] = useState<UtilityTab>("water");
  const sourceType = activeTab === "common-electricity" ? "electricity" : activeTab;
  const activeRows = rows[sourceType];
  const confirmation = confirmations[sourceType];
  const isLoading = loading[sourceType];
  const first = activeRows[0];
  const charge = confirmation?.totalAmount ?? total(activeRows, (row) => row.manualCharge ?? row.automaticCharge);
  const values = [
    activeRows.length ? "-" : "-",
    first?.customerNumber ?? "-",
    activeRows.length,
    total(activeRows, (row) => row.usage),
    activeRows.some((row) => row.manualCharge != null)
      ? total(activeRows, (row) => row.manualCharge)
      : null,
    total(activeRows, (row) => row.discountAmount),
    null,
    charge || null,
    null,
    first?.resolvedUnitPrice ?? first?.unitPrice ?? null,
    null,
    null,
    total(activeRows, (row) => row.currentReading),
    total(activeRows, (row) => row.previousReading),
  ];

  return (
    <section className="h-[196px] overflow-hidden rounded-[16px] bg-surface shadow-card">
      <div className="flex h-[44px] items-end border-b border-line2 px-[18px]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`relative h-[44px] min-w-[72px] px-[14px] text-[13px] font-bold ${
              activeTab === tab.key ? "text-teal" : "text-t3"
            }`}
          >
            {tab.label}
            {activeTab === tab.key && <span className="absolute inset-x-[9px] bottom-0 h-[2px] rounded-full bg-teal" />}
          </button>
        ))}
        {buildingSelected && confirmation && (
          <span className="mb-[11px] ml-auto rounded-full bg-[#e2f5f1] px-[9px] py-[3px] text-[11px] font-bold text-teal">
            산정 완료
          </span>
        )}
      </div>

      {!buildingSelected ? (
        <div className="flex h-[152px] items-center justify-center text-[13px] font-medium text-t4">
          건물을 선택하면 표시돼요
        </div>
      ) : isLoading ? (
        <div className="flex h-[152px] items-center justify-center text-[13px] font-medium text-t3">
          공과금 정보를 불러오는 중입니다.
        </div>
      ) : (
        <div className="h-[152px] overflow-x-auto px-[18px] py-[13px]">
          <table className="min-w-[1050px] table-fixed text-center text-[12px]">
            <thead className="text-t3">
              <tr className="h-[35px] border-y border-line2 bg-[#fbfcfd]">
                {headers.map((header) => <th key={header} className="px-[8px] font-bold">{header}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="h-[48px] border-b border-line2 font-semibold text-t1">
                {values.map((value, index) => (
                  <td key={headers[index]} className={index === 7 ? "font-extrabold text-teal" : ""}>
                    {typeof value === "number" ? numberOrDash(value) : value ?? "-"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          {activeTab === "common-electricity" && (
            <p className="mt-[8px] text-right text-[10.5px] text-t4">공용전기는 전기 산정 내역에 포함되어 표시됩니다.</p>
          )}
        </div>
      )}
    </section>
  );
}
