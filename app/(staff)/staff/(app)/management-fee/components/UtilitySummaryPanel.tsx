"use client";

import { useMemo, useState } from "react";
import type { BuildingCustomerNumber } from "@/hooks/reactquery/buildingCustomerNumbers";
import type { UtilityConfirmation, UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";

type UtilityTab = "water" | "electricity" | "common-electricity" | "gas";
type SourceType = "water" | "electricity" | "gas";
type UtilitySettingKind = "water" | "elec" | "gas";

interface UtilitySummaryPanelProps {
  buildingSelected: boolean;
  rows: Record<SourceType, UtilityUnitRow[]>;
  previousRows: Record<SourceType, UtilityUnitRow[]>;
  customerNumbers: BuildingCustomerNumber[];
  customerNumbersLoading: boolean;
  confirmations: Record<SourceType, UtilityConfirmation | null>;
  loading: Record<SourceType, boolean>;
}

const tabs: { key: UtilityTab; label: string }[] = [
  { key: "water", label: "수도" },
  { key: "electricity", label: "전기" },
  { key: "common-electricity", label: "공용전기" },
  { key: "gas", label: "가스" },
];

type CellSpec = { text: string; muted?: boolean; weight?: string; className?: string };

interface UtilityDisplayRow {
  current: UtilityUnitRow;
  previous?: UtilityUnitRow;
  billingBasis: "prev" | "current" | null;
}

interface CommonElectricityRow {
  id: number;
  customerNumber: string;
  billingBasis: "prev" | "current";
}

interface UtilityColumn<T> {
  key: string;
  label: string;
  minW: number;
  rt?: boolean; // 우측 정렬 (원본 c[0]==='rt')
  num?: boolean; // tabular-nums (원본 .num)
  render: (row: T, index: number) => CellSpec;
}

// 값이 없는 셀: 흐린 '-' (원본 .dsh)
const emptyCell = (): CellSpec => ({ text: "-", muted: true });

const valueCell = (value: number | null | undefined, weight?: string): CellSpec =>
  value == null ? emptyCell() : { text: formatNumber(value), weight };

function chargeFor(row: UtilityUnitRow | undefined): number | null {
  return row ? row.manualCharge ?? row.automaticCharge : null;
}

function priceFor(row: UtilityUnitRow | undefined): number | null {
  return row ? row.resolvedUnitPrice ?? row.unitPrice : null;
}

function differenceCell(current: number | null, previous: number | null): CellSpec {
  if (current == null || previous == null) return emptyCell();
  const difference = current - previous;
  return { text: formatNumber(difference), className: difference < 0 ? "text-red" : "" };
}

// 원본 drawUtil 셀 정의(UCOL)를 실데이터 컬럼으로 1:1 매핑한다.
// 전월금액·전단가 = 전월분 같은 세대 행, 금-전 = 금월 − 전월(헤더 라벨 기준 — 원본 더미 수식은 부호가 반대).
const COL = {
  L: { key: "L", label: "L", minW: 34, rt: true, num: true, render: (_row, index) => ({ text: String(index + 1) }) },
  cust: {
    key: "cust", label: "고객번호", minW: 104, num: true,
    render: (row) => row.current.customerNumber
      ? { text: row.current.customerNumber, weight: "font-bold" }
      : emptyCell(),
  },
  month: {
    key: "month", label: "월", minW: 48,
    render: (row) => row.billingBasis ? { text: row.billingBasis === "prev" ? "전월" : "당월" } : emptyCell(),
  },
  usage: { key: "usage", label: "량", minW: 48, rt: true, num: true, render: (row) => valueCell(row.current.usage) },
  manual: {
    key: "manual", label: "수동입력", minW: 70, rt: true, num: true,
    render: (row) => row.current.manualCharge
      ? { text: formatNumber(row.current.manualCharge), weight: "font-semibold" }
      : emptyCell(),
  },
  discount: {
    key: "discount", label: "할인금액", minW: 74, rt: true, num: true,
    render: (row) => row.current.discountAmount
      ? { text: `-${formatNumber(row.current.discountAmount)}`, weight: "font-semibold" }
      : emptyCell(),
  },
  previousCharge: {
    key: "previousCharge", label: "전월금액", minW: 76, rt: true, num: true,
    render: (row) => valueCell(chargeFor(row.previous), "font-normal"),
  },
  charge: {
    key: "charge", label: "부과액", minW: 76, rt: true, num: true,
    render: (row) => valueCell(chargeFor(row.current), "font-bold"),
  },
  previousPrice: {
    key: "previousPrice", label: "전단가", minW: 62, rt: true, num: true,
    render: (row) => valueCell(priceFor(row.previous), "font-normal"),
  },
  price: {
    key: "price", label: "단가", minW: 58, rt: true, num: true,
    render: (row) => valueCell(priceFor(row.current), "font-semibold"),
  },
  chargeDifference: {
    key: "chargeDifference", label: "금-전1", minW: 66, rt: true, num: true,
    render: (row) => differenceCell(chargeFor(row.current), chargeFor(row.previous)),
  },
  priceDifference: {
    key: "priceDifference", label: "금-전2", minW: 62, rt: true, num: true,
    render: (row) => differenceCell(priceFor(row.current), priceFor(row.previous)),
  },
  curr: { key: "curr", label: "금월량", minW: 62, rt: true, num: true, render: (row) => valueCell(row.current.currentReading) },
  prev: { key: "prev", label: "전월량", minW: 62, rt: true, num: true, render: (row) => valueCell(row.current.previousReading, "font-medium") },
  notice: { key: "notice", label: "고지금액", minW: 76, rt: true, num: true, render: () => emptyCell() },
  reduce: {
    key: "reduce", label: "감면", minW: 62, rt: true, num: true,
    render: (row) => row.current.discountAmount
      ? { text: `-${formatNumber(row.current.discountAmount)}` }
      : { text: "0", muted: true },
  },
  moving: {
    key: "moving", label: "이사", minW: 52, rt: true,
    render: (row) => row.current.occupancyStatus === "moving_out" ? { text: "이사" } : emptyCell(),
  },
} satisfies Record<string, UtilityColumn<UtilityDisplayRow>>;

const COLUMNS: Record<Exclude<UtilityTab, "common-electricity">, UtilityColumn<UtilityDisplayRow>[]> = {
  water: [COL.L, COL.cust, COL.month, COL.usage, COL.manual, COL.discount, COL.previousCharge, COL.charge, COL.previousPrice, COL.price, COL.chargeDifference, COL.priceDifference, COL.curr, COL.prev],
  electricity: [COL.L, COL.cust, COL.notice, COL.charge, COL.usage, COL.price, COL.curr, COL.prev, COL.reduce, COL.moving],
  gas: [COL.L, COL.cust, COL.month, COL.usage, COL.manual, COL.discount, COL.previousCharge, COL.charge, COL.previousPrice, COL.price, COL.chargeDifference, COL.priceDifference, COL.curr, COL.prev],
};

// 공용전기: 건물 공용전기 고객번호(building_customer_numbers)만 실데이터 — 고객번호·월분 외 값은 저장 필드가 없어 '-'.
const COMMON_COLUMNS: UtilityColumn<CommonElectricityRow>[] = [
  { key: "L", label: "L", minW: 34, rt: true, num: true, render: (_row, index) => ({ text: String(index + 1) }) },
  { key: "cust", label: "고객번호", minW: 104, num: true, render: (row) => ({ text: row.customerNumber, weight: "font-bold" }) },
  { key: "notice", label: "고지액", minW: 76, rt: true, num: true, render: () => emptyCell() },
  { key: "commonCharge", label: "공용부과액", minW: 86, rt: true, num: true, render: () => emptyCell() },
  { key: "curr", label: "금월량", minW: 62, rt: true, num: true, render: () => emptyCell() },
  { key: "prev", label: "전월량", minW: 62, rt: true, num: true, render: () => emptyCell() },
  { key: "charge", label: "부과액", minW: 76, rt: true, num: true, render: () => emptyCell() },
  { key: "price", label: "단가", minW: 58, rt: true, num: true, render: () => emptyCell() },
  { key: "month", label: "월분", minW: 56, render: (row) => ({ text: row.billingBasis === "prev" ? "전월" : "당월" }) },
];

function settingKindFor(tab: Exclude<UtilityTab, "common-electricity" | "electricity">): UtilitySettingKind {
  return tab === "water" ? "water" : "gas";
}

function settingForRow(
  row: UtilityUnitRow,
  kind: UtilitySettingKind,
  customerNumbers: BuildingCustomerNumber[],
): BuildingCustomerNumber | null {
  const candidates = customerNumbers.filter((number) => number.kind === kind);
  const direct = row.customerNumber
    ? candidates.find((number) => number.customerNo === row.customerNumber)
    : undefined;
  return direct ?? (candidates.length === 1 ? candidates[0] : null);
}

export function UtilitySummaryPanel({
  buildingSelected,
  rows,
  previousRows,
  customerNumbers,
  customerNumbersLoading,
  confirmations,
  loading,
}: UtilitySummaryPanelProps) {
  const [activeTab, setActiveTab] = useState<UtilityTab>("water");
  const normalTab = activeTab === "common-electricity" ? null : activeTab;
  const previousByUnit = useMemo(
    () => new Map((normalTab ? previousRows[normalTab] : []).map((row) => [row.unitId, row])),
    [normalTab, previousRows],
  );
  const displayRows = useMemo(() => {
    const kind = normalTab === "water" || normalTab === "gas" ? settingKindFor(normalTab) : null;
    return (normalTab ? rows[normalTab] : []).map((row) => ({
      current: row,
      previous: previousByUnit.get(row.unitId),
      billingBasis: kind ? settingForRow(row, kind, customerNumbers)?.billingBasis ?? null : null,
    }));
  }, [customerNumbers, normalTab, previousByUnit, rows]);
  const commonRows = useMemo<CommonElectricityRow[]>(
    () => customerNumbers
      .filter((number) => number.kind === "common_elec")
      .map((number) => ({ id: number.id, customerNumber: number.customerNo, billingBasis: number.billingBasis })),
    [customerNumbers],
  );
  // 공용전기는 산정 데이터가 없어 산정 완료 배지를 띄우지 않는다.
  const confirmation = normalTab ? confirmations[normalTab] : null;
  const isActiveUtilityLoading = activeTab === "common-electricity"
    ? customerNumbersLoading
    : loading[activeTab];
  const normalColumns = activeTab === "common-electricity" ? null : COLUMNS[activeTab];
  const columns = normalColumns ?? COMMON_COLUMNS;
  const hasRows = activeTab === "common-electricity" ? commonRows.length > 0 : displayRows.length > 0;

  const message = !buildingSelected
    ? "건물을 선택하면 표시돼요"
    : isActiveUtilityLoading
      ? "공과금 정보를 불러오는 중입니다."
      : !hasRows
        ? "등록된 고객번호가 없어요"
        : null;

  const renderCell = (cell: CellSpec) => (
    <span className={cell.muted ? "font-medium text-t3" : [cell.weight, cell.className].filter(Boolean).join(" ")}>
      {cell.text}
    </span>
  );

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

      {/* 본문 표 (원본 .hf-tbl 기본값: th #FBFCFD · 셀 좌우 16px · 컬럼별 min-width) */}
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <table className="w-full border-collapse whitespace-nowrap [&_tbody_tr:last-child_td]:border-b-0">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ minWidth: col.minW }}
                  className={`border-b border-line bg-[#fbfcfd] px-[16px] py-[11px] text-[12px] font-bold text-t3 ${
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
                <td
                  colSpan={columns.length}
                  role={isActiveUtilityLoading ? "status" : undefined}
                  aria-label={isActiveUtilityLoading ? "공과금 정보 불러오는 중" : undefined}
                  className="px-0 py-[22px] text-center text-[13.5px] font-medium text-t3"
                >
                  {message}
                </td>
              </tr>
            ) : activeTab === "common-electricity" ? (
              commonRows.map((row, index) => (
                <tr key={row.id} className="cursor-pointer text-t1 hover:bg-[#fbfcfd]">
                  {COMMON_COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={`border-b border-line2 px-[16px] py-[12px] text-[13.5px] ${
                        col.rt ? "text-right" : "text-left"
                      } ${col.num ? "tabular-nums" : ""}`}
                    >
                      {renderCell(col.render(row, index))}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              displayRows.map((row, index) => (
                <tr key={row.current.unitId} className="cursor-pointer text-t1 hover:bg-[#fbfcfd]">
                  {normalColumns!.map((col) => (
                    <td
                      key={col.key}
                      className={`border-b border-line2 px-[16px] py-[12px] text-[13.5px] ${
                        col.rt ? "text-right" : "text-left"
                      } ${col.num ? "tabular-nums" : ""}`}
                    >
                      {renderCell(col.render(row, index))}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
