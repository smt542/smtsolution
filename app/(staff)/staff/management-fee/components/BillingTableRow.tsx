"use client";

import { memo } from "react";
import type { BillingColumn, BillingUnitRow } from "@/lib/billing/pivot";
import { formatNumber } from "@/lib/format";
import { billingRowTotal, isRecentMoveIn, type BillingChargeDraft, type BillingNoteDraft } from "./billingTableModel";

interface BillingTableRowProps {
  unit: BillingUnitRow;
  columns: BillingColumn[];
  period: string;
  editing: boolean;
  chargeDrafts?: Record<number, BillingChargeDraft>;
  noteDraft?: BillingNoteDraft;
  onChargeChange: (unitId: number, feeItemId: number, patch: { charged?: boolean; amount?: number }) => void;
  onRowClick: (unitId: number) => void;
  onNoteClick: (unitId: number) => void;
}

export const BillingTableRow = memo(function BillingTableRow({
  unit, columns, period, editing, chargeDrafts, noteDraft, onChargeChange, onRowClick, onNoteClick,
}: BillingTableRowProps) {
  const recent = isRecentMoveIn(unit.moveInDate, period);
  const displayTotal = unit.confirmedAt && !unit.isDirty && unit.totalAmount != null
    ? unit.totalAmount
    : billingRowTotal(unit, columns, period, chargeDrafts);
  const billingNote = noteDraft?.billingNote ?? unit.billingNote ?? "";
  const unitNotice = noteDraft?.unitNotice ?? unit.unitNotice ?? "";

  return (
    <tr className={`h-[58px] border-b border-line2 text-[12px] ${recent ? "bg-[#f2f6ff]" : ""} ${unit.isVacant ? "bg-[#fff9ed] text-t3" : "text-t1"}`}>
      <td className="sticky left-0 z-[1] border-b border-r border-line2 bg-inherit px-[10px] text-center">
        <button type="button" className="font-extrabold text-teal hover:underline" onClick={() => onRowClick(unit.unitId)}>{unit.unitNo}</button>
      </td>
      <td className="border-b border-r border-line2 px-[10px] text-right font-extrabold">{formatNumber(displayTotal)}</td>
      <td className="min-w-[138px] border-b border-r border-line2 px-[10px] leading-[17px]">
        <p className="truncate font-bold">{unit.isVacant ? "공실" : unit.tenantName ?? "-"}</p>
        <p className="truncate text-[10.5px] text-t3">{[unit.roomTypeLabel, recent ? "최근 입주" : unit.moveInDate].filter(Boolean).join(" · ") || "-"}</p>
      </td>
      {columns.map((column) => {
        const cell = chargeDrafts?.[column.feeItemId] ?? unit.charges[column.feeItemId] ?? { charged: true, amount: 0 };
        return (
          <td key={column.feeItemId} className="min-w-[100px] border-b border-r border-line2 px-[7px] text-center">
            {editing ? (
              <div className="flex items-center justify-center gap-[5px]">
                <button
                  type="button"
                  aria-label={`${unit.unitNo} ${column.name} 부과`}
                  aria-pressed={cell.charged}
                  disabled={unit.isVacant}
                  onClick={() => onChargeChange(unit.unitId, column.feeItemId, { charged: !cell.charged })}
                  className={`h-[28px] w-[28px] rounded-[7px] border text-[10px] font-extrabold disabled:opacity-40 ${cell.charged ? "border-teal bg-[#e2f5f1] text-teal" : "border-line text-t4"}`}
                >
                  {cell.charged ? "Y" : "N"}
                </button>
                <input
                  type="number"
                  aria-label={`${unit.unitNo} ${column.name} 금액`}
                  value={String(cell.amount)}
                  disabled={unit.isVacant || !cell.charged}
                  onChange={(event) => onChargeChange(unit.unitId, column.feeItemId, { amount: Number(event.target.value) || 0 })}
                  className="h-[28px] w-[66px] rounded-[7px] border border-line bg-white px-[7px] text-right font-semibold outline-none focus:border-teal disabled:bg-bg"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center gap-[6px]">
                <span className={`rounded-[6px] px-[5px] py-[2px] text-[9.5px] font-extrabold ${cell.charged ? "bg-[#e2f5f1] text-teal" : "bg-bg text-t4"}`}>{cell.charged ? "Y" : "N"}</span>
                <span className="font-semibold">{formatNumber(cell.amount)}</span>
              </div>
            )}
          </td>
        );
      })}
      <td className="min-w-[116px] border-b border-r border-line2 px-[8px] text-center">
        <button type="button" aria-label={`${unit.unitNo} 부과시 참조사항`} onClick={() => onNoteClick(unit.unitId)} className="max-w-[104px] truncate text-t2 hover:text-teal">{billingNote || "-"}</button>
      </td>
      <td className="min-w-[116px] border-b border-r border-line2 px-[8px] text-center">
        <button type="button" aria-label={`${unit.unitNo} 부과시 공지사항`} onClick={() => onNoteClick(unit.unitId)} className="max-w-[104px] truncate text-t2 hover:text-teal">{unitNotice || "-"}</button>
      </td>
      <td className="min-w-[92px] border-b border-line2 px-[8px] text-center text-[10.5px] text-t3">
        {unit.confirmedAt ? unit.confirmedAt.slice(0, 10) : "-"}
        {unit.confirmedAt && unit.isDirty && <p className="font-bold text-amber">재확정 필요</p>}
        {unit.confirmedAt && !unit.isDirty && <p className="font-bold text-teal">확정</p>}
      </td>
    </tr>
  );
});
