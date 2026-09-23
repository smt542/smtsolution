"use client";

import { memo } from "react";
import { applyMask, NUMERIC_INPUT_ATTRS, type InputMask } from "@/components/common";
import type { BillingColumn, BillingUnitRow } from "@/lib/billing/pivot";
import { formatNumber } from "@/lib/format";
import {
  billingFixedItemsTotal,
  billingItemsTotal,
  effectiveChargeAmount,
  isRecentMoveIn,
  unitAreaPyeong,
  unitUtilityAmounts,
  type BillingChargeDraft,
  type BillingNoteDraft,
  type UtilityRowSet,
} from "./billingTableModel";

interface BillingTableRowProps {
  unit: BillingUnitRow;
  columns: BillingColumn[];
  trios: BillingColumn[][];
  period: string;
  editing: boolean;
  utilities: UtilityRowSet;
  chargeDrafts?: Record<number, BillingChargeDraft>;
  noteDraft?: BillingNoteDraft;
  onChargeChange: (unitId: number, feeItemId: number, patch: { charged?: boolean; amount?: number }) => void;
  onRowClick: (unitId: number) => void;
  onNoteChange: (unitId: number, patch: Partial<BillingNoteDraft>) => void;
}

function num(value: number): string {
  return formatNumber(value);
}

// 원본 수정모드 .mf-in: 천단위 콤마로 보이고 0은 빈칸이다.
const amountMask: InputMask = (raw) => {
  const digits = raw.replace(/\D/g, "");
  return digits ? num(Number(digits)) : "";
};

export const BillingTableRow = memo(function BillingTableRow({
  unit, columns, trios, period, editing, utilities, chargeDrafts, noteDraft, onChargeChange, onRowClick, onNoteChange,
}: BillingTableRowProps) {
  const recent = isRecentMoveIn(unit.moveInDate, period);
  const util = unitUtilityAmounts(unit.unitId, utilities);
  const anomaly = unit.isVacant && util.sum > 0;
  // 총 관리비 = 청구액(항목 합계). 공과금도 항목(전기·수도료·가스)이라 공과금 칸 금액을 또 더하지 않는다.
  // 확정·비수정 상태면 확정 스냅샷 totalAmount가 곧 청구액이다.
  const itemsTotal = unit.confirmedAt && !unit.isDirty && unit.totalAmount != null
    ? unit.totalAmount
    : billingItemsTotal(unit, columns, period, chargeDrafts);
  const displayTotal = unit.isVacant ? 0 : itemsTotal;
  // 건물 관리비 = 입주자 계약 관리비(occupancies.mgmt_fee_amount). 총 관리비에 합산하지 않는 참고값이며 공실은 원본처럼 0.
  const buildingTotal = unit.isVacant ? 0 : unit.mgmtFeeAmount ?? 0;
  const fixedTotal = unit.isVacant ? 0 : billingFixedItemsTotal(unit, columns, period, chargeDrafts);
  const billingNote = noteDraft?.billingNote ?? unit.billingNote ?? "";
  const unitNotice = noteDraft?.unitNotice ?? unit.unitNotice ?? "";
  const areaPyeong = unitAreaPyeong(unit);
  const unitNo = [unit.dong, unit.unitNo].filter(Boolean).join(" ");

  // 원본 행 상태: 공실 → 텍스트 t4, 이상(공실+공과금>0) → 좌측 빨강 바, 최근입주 → 좌측 초록 바.
  const rowStateText = unit.isVacant ? "text-t4" : "text-t1";
  const firstCellBar = anomaly
    ? "shadow-[inset_3px_0_0_var(--color-red)]"
    : recent
      ? "shadow-[inset_3px_0_0_var(--color-green)]"
      : "";
  const cellBorder = "border-b border-line2";

  return (
    <tr className={`align-top text-[13.5px] ${rowStateText}`}>
      {/* 호수 — 56px sticky left:0, .mf-nocell 700 중앙 */}
      <td className={`sticky left-0 z-[2] w-[56px] min-w-[56px] max-w-[56px] bg-surface px-[8px] py-[7px] text-center align-middle text-[13.5px] font-bold ${cellBorder} ${firstCellBar}`}>
        <button type="button" className="cursor-pointer whitespace-normal break-keep font-bold text-inherit" onClick={() => onRowClick(unit.unitId)}>{unitNo}</button>
      </td>

      {/* 총 관리비 — 92px sticky left:56px, .mf-totcell (3줄: 총관리비 / 건물관리비 / 고정관리비) */}
      <td className={`sticky left-[56px] z-[2] w-[92px] min-w-[92px] max-w-[92px] bg-surface px-[8px] py-[7px] text-left align-middle text-[13.5px] font-bold ${unit.isVacant ? "text-t4" : "text-t1"} ${cellBorder}`}>
        <div className="tabular-nums leading-[normal]">{num(displayTotal)}</div>
        <div className={`mt-[2px] text-[11.5px] font-semibold leading-[normal] tabular-nums ${unit.isVacant ? "text-t4" : "text-t3"}`}>{num(buildingTotal)}</div>
        <div className={`mt-[2px] text-[11.5px] font-semibold leading-[normal] tabular-nums ${unit.isVacant ? "text-t4" : "text-t3"}`}>{num(fixedTotal)}</div>
      </td>

      {/* 성명 / 평수·룸타입 / 입주일 — 92px, 3줄 */}
      <td className={`min-w-[92px] px-[8px] py-[7px] ${cellBorder}`}>
        <div className="text-[13.5px] font-normal leading-[1.5]">{unit.isVacant ? "-" : unit.tenantName ?? "-"}</div>
        <div className="text-[13.5px] font-normal leading-[1.5] tabular-nums">{unit.isVacant ? "" : `${areaPyeong ?? "-"}평 / ${unit.roomTypeLabel ?? "-"}`}</div>
        <div className={`text-[13.5px] font-normal leading-[1.5] tabular-nums ${recent ? "font-bold text-green" : ""}`}>{unit.isVacant ? "" : unit.moveInDate ?? "-"}</div>
      </td>

      {/* 수도 / 전기 / 가스 금액 — 78px, 3줄 (이상 시 빨강) */}
      <td className={`min-w-[78px] px-[8px] py-[7px] text-left tabular-nums ${cellBorder}`}>
        <div className={`text-[13.5px] font-normal leading-[1.5] ${anomaly ? "font-bold text-red" : ""}`}>{num(util.water)}</div>
        <div className={`text-[13.5px] font-normal leading-[1.5] ${anomaly ? "font-bold text-red" : ""}`}>{num(util.electricity)}</div>
        <div className={`text-[13.5px] font-normal leading-[1.5] ${anomaly ? "font-bold text-red" : ""}`}>{num(util.gas)}</div>
      </td>

      {/* 항목 컬럼 (TRIOS: <td> 하나에 최대 3개 셀) */}
      {trios.map((group, groupIndex) => (
        <td key={group[0]?.feeItemId ?? `trio-${groupIndex}`} className={`min-w-[104px] px-[8px] py-[7px] ${cellBorder}`}>
          {group.map((column) => {
            const cell = chargeDrafts?.[column.feeItemId] ?? unit.charges[column.feeItemId] ?? { charged: true, amount: 0 };
            const shown = cell.charged ? effectiveChargeAmount(column, cell.amount, unit.moveInDate, period) : cell.amount;
            const prorated = shown !== cell.amount;
            return (
              <div key={column.feeItemId} className="flex items-center justify-start gap-[4px] leading-[1.5]">
                {editing ? (
                  <input
                    type="text"
                    {...NUMERIC_INPUT_ATTRS}
                    aria-label={`${unitNo} ${column.name} 금액`}
                    value={cell.amount ? num(cell.amount) : ""}
                    disabled={unit.isVacant || !cell.charged}
                    onChange={(event) => {
                      const masked = applyMask(event.currentTarget, amountMask);
                      onChargeChange(unit.unitId, column.feeItemId, { amount: Number(masked.replace(/\D/g, "")) || 0 });
                    }}
                    className="h-[26px] w-full min-w-0 rounded-[7px] border border-line bg-white px-[6px] text-[13.5px] font-normal text-t1 outline-none focus:border-teal focus:shadow-[0_0_0_3px_var(--color-blue-t)] disabled:bg-bg"
                  />
                ) : (
                  <span
                    className={`${unit.isVacant ? "text-t4" : cell.charged ? "text-t1" : "text-red"} text-[13.5px] font-normal leading-[1.5] tabular-nums`}
                    title={prorated ? `${num(cell.amount)}원 · 일할` : undefined}
                  >
                    {shown ? num(shown) : "-"}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`${unitNo} ${column.name} 부과`}
                  aria-pressed={cell.charged}
                  disabled={unit.isVacant}
                  onClick={() => onChargeChange(unit.unitId, column.feeItemId, { charged: !cell.charged })}
                  className={`inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[6px] text-[10px] font-extrabold disabled:opacity-40 ${cell.charged ? "bg-blue-t text-blue-d" : "bg-red-t text-red"}`}
                >
                  {cell.charged ? "Y" : "N"}
                </button>
              </div>
            );
          })}
          {/* 빈 슬롯 채움(3개 미만일 때 정렬 유지) */}
          {Array.from({ length: 3 - group.length }).map((_, i) => (
            <div key={`pad-${i}`} className="leading-[1.5]">&nbsp;</div>
          ))}
        </td>
      ))}

      {/* 부과시 참조사항 — 150px 인라인 편집 */}
      <td className={`min-w-[150px] px-[8px] py-[7px] ${cellBorder}`}>
        {editing ? (
          <input
            aria-label={`${unitNo} 부과시 참조사항`}
            value={billingNote}
            onChange={(event) => onNoteChange(unit.unitId, { billingNote: event.target.value })}
            className="h-[26px] w-full rounded-[7px] border border-line bg-white px-[7px] text-[13.5px] font-normal text-t1 outline-none focus:border-teal focus:shadow-[0_0_0_3px_var(--color-blue-t)]"
          />
        ) : (
          <span
            className={`line-clamp-2 block max-w-[150px] break-words text-[13.5px] font-normal leading-[1.5] ${unit.isVacant ? "text-t4" : "text-t1"}`}
            title={billingNote || undefined}
          >
            {billingNote || "-"}
          </span>
        )}
      </td>

      {/* 부과시 공지사항 — 150px 인라인 편집 */}
      <td className={`min-w-[150px] px-[8px] py-[7px] ${cellBorder}`}>
        {editing ? (
          <input
            aria-label={`${unitNo} 부과시 공지사항`}
            value={unitNotice}
            onChange={(event) => onNoteChange(unit.unitId, { unitNotice: event.target.value })}
            className="h-[26px] w-full rounded-[7px] border border-line bg-white px-[7px] text-[13.5px] font-normal text-t1 outline-none focus:border-teal focus:shadow-[0_0_0_3px_var(--color-blue-t)]"
          />
        ) : (
          <span
            className={`line-clamp-2 block max-w-[150px] break-words text-[13.5px] font-normal leading-[1.5] ${unit.isVacant ? "text-t4" : "text-t1"}`}
            title={unitNotice || undefined}
          >
            {unitNotice || "-"}
          </span>
        )}
      </td>

      {/* 처리일자 — 96px */}
      <td className={`min-w-[96px] px-[8px] py-[7px] text-left align-top tabular-nums ${cellBorder}`}>
        <span className="text-[13.5px] font-normal text-t1">{unit.confirmedAt ? unit.confirmedAt.slice(0, 10) : "-"}</span>
        {unit.confirmedAt && unit.isDirty && <p className="text-[11.5px] font-bold text-amber">재확정 필요</p>}
      </td>
    </tr>
  );
});
