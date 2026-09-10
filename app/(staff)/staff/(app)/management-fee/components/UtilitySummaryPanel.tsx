"use client";

import { useState } from "react";
import type { UtilityConfirmation, UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";

type UtilityTab = "water" | "electricity" | "common-electricity" | "gas";
type SourceType = "water" | "electricity" | "gas";

interface UtilitySummaryPanelProps {
  buildingSelected: boolean;
  rows: Record<SourceType, UtilityUnitRow[]>;
  confirmations: Record<SourceType, UtilityConfirmation | null>;
  loading: Record<SourceType, boolean>;
}

const tabs: { key: UtilityTab; label: string }[] = [
  { key: "water", label: "수도" },
  { key: "electricity", label: "전기" },
  { key: "common-electricity", label: "공용전기" },
  { key: "gas", label: "가스" },
];

type CellSpec = { text: string; muted?: boolean; weight?: string };

interface UtilityColumn {
  key: string;
  label: string;
  minW: number;
  rt?: boolean; // 우측 정렬 (원본 c[0]==='rt')
  num?: boolean; // tabular-nums (원본 .num)
  render: (row: UtilityUnitRow, index: number) => CellSpec;
}

// 값 셀: 숫자면 표시, 없으면 흐린 '-' (원본 .dsh)
const valueCell = (value: number | null | undefined, weight?: string): CellSpec =>
  value == null ? { text: "-", muted: true } : { text: formatNumber(value), weight };

// 원본 drawUtil 셀 정의를 실데이터 컬럼으로 1:1 매핑한다.
const COL = {
  L: { key: "L", label: "L", minW: 34, rt: true, num: true, render: (_row, index) => ({ text: String(index + 1) }) },
  cust: {
    key: "cust", label: "고객번호", minW: 104, num: true,
    render: (row) => (row.customerNumber ? { text: row.customerNumber, weight: "font-bold" } : { text: "-", muted: true }),
  },
  usage: { key: "usage", label: "량", minW: 48, rt: true, num: true, render: (row) => valueCell(row.usage) },
  manual: {
    key: "manual", label: "수동입력", minW: 70, rt: true, num: true,
    render: (row) => (row.manualCharge ? { text: formatNumber(row.manualCharge), weight: "font-semibold" } : { text: "-", muted: true }),
  },
  discount: {
    key: "discount", label: "할인금액", minW: 74, rt: true, num: true,
    render: (row) => (row.discountAmount ? { text: `-${formatNumber(row.discountAmount)}`, weight: "font-semibold" } : { text: "-", muted: true }),
  },
  charge: {
    key: "charge", label: "부과액", minW: 76, rt: true, num: true,
    render: (row) => {
      const value = row.manualCharge ?? row.automaticCharge;
      return value == null ? { text: "-", muted: true } : { text: formatNumber(value), weight: "font-bold" };
    },
  },
  price: {
    key: "price", label: "단가", minW: 58, rt: true, num: true,
    render: (row) => {
      const value = row.resolvedUnitPrice ?? row.unitPrice;
      return value == null ? { text: "-", muted: true } : { text: formatNumber(value), weight: "font-semibold" };
    },
  },
  curr: { key: "curr", label: "금월량", minW: 62, rt: true, num: true, render: (row) => valueCell(row.currentReading) },
  prev: { key: "prev", label: "전월량", minW: 62, rt: true, num: true, render: (row) => valueCell(row.previousReading, "font-medium") },
  reduce: {
    key: "reduce", label: "감면", minW: 62, rt: true, num: true,
    render: (row) => (row.discountAmount ? { text: `-${formatNumber(row.discountAmount)}` } : { text: "0", muted: true }),
  },
} satisfies Record<string, UtilityColumn>;

const COLUMNS: Record<UtilityTab, UtilityColumn[]> = {
  water: [COL.L, COL.cust, COL.usage, COL.manual, COL.discount, COL.charge, COL.price, COL.curr, COL.prev],
  electricity: [COL.L, COL.cust, COL.charge, COL.usage, COL.price, COL.curr, COL.prev, COL.reduce],
  "common-electricity": [COL.L, COL.cust, COL.curr, COL.prev, COL.charge, COL.price],
  gas: [COL.L, COL.cust, COL.usage, COL.manual, COL.discount, COL.charge, COL.price, COL.curr, COL.prev],
};

export function UtilitySummaryPanel({ buildingSelected, rows, confirmations, loading }: UtilitySummaryPanelProps) {
  const [activeTab, setActiveTab] = useState<UtilityTab>("water");
  const sourceType: SourceType = activeTab === "common-electricity" ? "electricity" : activeTab;
  const activeRows = rows[sourceType];
  const confirmation = confirmations[sourceType];
  const isLoading = loading[sourceType];
  const columns = COLUMNS[activeTab];

  const message = !buildingSelected
    ? "건물을 선택하면 표시돼요"
    : isLoading
      ? "공과금 정보를 불러오는 중입니다."
      : activeRows.length === 0
        ? "등록된 고객번호가 없어요"
        : null;

  return (
    <section className="flex h-[196px] min-w-0 flex-col overflow-hidden rounded-[16px] bg-surface shadow-card">
      {/* 탭바 (원본 #mfUtil: padding 13px · gap 4px · 하단 2px 밑줄) */}
      <div className="flex flex-none items-center border-b border-line2 px-[18px]">
        <div className="flex gap-[4px]">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`-mb-px border-b-2 px-[13px] py-[13px] text-[13px] font-bold ${
                  active ? "border-teal text-teal" : "border-transparent text-t3"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {buildingSelected && confirmation && (
          <span className="ml-auto rounded-full bg-[#e2f5f1] px-[9px] py-[3px] text-[11px] font-bold text-teal">
            산정 완료
          </span>
        )}
      </div>

      {/* 본문 표 (원본 .hf-tbl: th #FBFCFD · 셀 좌우 8px · 컬럼별 min-width) */}
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <table className="w-full border-collapse whitespace-nowrap [&_tbody_tr:last-child_td]:border-b-0">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ minWidth: col.minW }}
                  className={`border-b border-line bg-[#fbfcfd] px-[8px] py-[11px] text-[12px] font-bold text-t3 ${
                    col.rt ? "text-right" : "text-left"
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {message ? (
              <tr>
                <td colSpan={columns.length} className="px-0 py-[22px] text-center text-[13.5px] font-medium text-t3">
                  {message}
                </td>
              </tr>
            ) : (
              activeRows.map((row, index) => (
                <tr key={row.unitId} className="cursor-pointer text-t1 hover:bg-[#fbfcfd]">
                  {columns.map((col) => {
                    const cell = col.render(row, index);
                    return (
                      <td
                        key={col.key}
                        className={`border-b border-line2 px-[8px] py-[12px] text-[13.5px] ${
                          col.rt ? "text-right" : "text-left"
                        } ${col.num ? "tabular-nums" : ""} ${cell.muted ? "font-medium text-t3" : cell.weight ?? ""}`}
                      >
                        {cell.text}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
        {activeTab === "common-electricity" && buildingSelected && !isLoading && activeRows.length > 0 && (
          <p className="px-[18px] pb-[10px] pt-[6px] text-right text-[11px] text-t4">
            공용전기는 전기 산정 내역에 포함되어 표시됩니다.
          </p>
        )}
      </div>
    </section>
  );
}
