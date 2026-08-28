"use client";
import React, { memo } from "react";
import type { BillingUnitRow, BillingColumn } from "@/lib/billing/pivot";
import { unitTotal, type ChargeLine } from "@/lib/billing/total";
import { formatNumber } from "@/lib/format";

interface BillingTableProps {
  units: BillingUnitRow[];
  columns: BillingColumn[];
  period: string;
  chargeDrafts?: Record<number, Record<number, BillingChargeDraft>>;
  noteDrafts?: Record<number, BillingNoteDraft>;
  onChargeChange: (unitId: number, feeItemId: number, patch: { charged?: boolean; amount?: number }) => void;
  onRowClick: (unitId: number) => void;
  onNoteClick: (unitId: number) => void;
}

export type BillingChargeDraft = { charged: boolean; amount: number };
export type BillingNoteDraft = { billingNote: string; unitNotice: string };

const EMPTY_CHARGE_DRAFTS: Record<number, Record<number, BillingChargeDraft>> = {};
const EMPTY_NOTE_DRAFTS: Record<number, BillingNoteDraft> = {};

const won = (n: number) => formatNumber(n);

function isMidMoveIn(moveInDate: string | null, period: string): boolean {
  return !!moveInDate && moveInDate.slice(0, 7) === period.slice(0, 7);
}

function rowTotal(
  u: BillingUnitRow,
  columns: BillingColumn[],
  period: string,
  drafts?: Record<number, BillingChargeDraft>,
): number {
  if (u.isVacant) return 0;
  const lines: ChargeLine[] = columns.map((c) => {
    const cell = drafts?.[c.feeItemId] ?? u.charges[c.feeItemId] ?? { charged: true, amount: 0 };
    return { charged: cell.charged, amount: cell.amount, dailyProration: c.dailyProration, rounding: c.rounding };
  });
  return unitTotal(lines, u.moveInDate, period);
}

export function BillingTable({
  units,
  columns,
  period,
  chargeDrafts = EMPTY_CHARGE_DRAFTS,
  noteDrafts = EMPTY_NOTE_DRAFTS,
  onChargeChange,
  onRowClick,
  onNoteClick,
}: BillingTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line2 bg-line2 text-left text-xs font-bold text-t2">
            <th className="px-3 py-2">호실</th>
            <th className="px-3 py-2">룸타입</th>
            <th className="px-3 py-2">입주일</th>
            <th className="px-3 py-2 text-right">합계</th>
            {columns.map((c) => (
              <th key={c.feeItemId} className="px-3 py-2">
                {c.name}
                {c.dailyProration && <span className="ml-1 rounded bg-blue-t px-1 text-[10px] text-blue-d">일할</span>}
              </th>
            ))}
            <th className="px-3 py-2">메모</th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => (
            <BillingRow
              key={unit.unitId}
              unit={unit}
              columns={columns}
              period={period}
              chargeDrafts={chargeDrafts[unit.unitId]}
              noteDraft={noteDrafts[unit.unitId]}
              onChargeChange={onChargeChange}
              onRowClick={onRowClick}
              onNoteClick={onNoteClick}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const BillingRow = memo(function BillingRow({
  unit,
  columns,
  period,
  chargeDrafts,
  noteDraft,
  onChargeChange,
  onRowClick,
  onNoteClick,
}: {
  unit: BillingUnitRow;
  columns: BillingColumn[];
  period: string;
  chargeDrafts?: Record<number, BillingChargeDraft>;
  noteDraft?: BillingNoteDraft;
  onChargeChange: BillingTableProps["onChargeChange"];
  onRowClick: BillingTableProps["onRowClick"];
  onNoteClick: BillingTableProps["onNoteClick"];
}) {
  const mid = isMidMoveIn(unit.moveInDate, period);
  const displayTotal =
    unit.confirmedAt && !unit.isDirty && unit.totalAmount != null
      ? unit.totalAmount
      : rowTotal(unit, columns, period, chargeDrafts);
  const hasNote = noteDraft
    ? noteDraft.billingNote || noteDraft.unitNotice
    : unit.billingNote || unit.unitNotice;

  return (
              <tr
                className={`border-b border-line2 ${mid ? "bg-blue-t" : ""} ${unit.isVacant ? "text-t3" : ""}`}
              >
                <td
                  className="cursor-pointer px-3 py-2 font-semibold text-blue-d"
                  onClick={() => onRowClick(unit.unitId)}
                >
                  {unit.unitNo}
                </td>
                <td className="px-3 py-2">{unit.roomTypeLabel ?? "-"}</td>
                <td className="px-3 py-2">
                  {unit.isVacant ? (
                    <span className="font-semibold">공실</span>
                  ) : (
                    unit.moveInDate ?? "-"
                  )}
                  {unit.confirmedAt && !unit.isDirty && (
                    <span className="ml-1 rounded bg-green-t px-1 text-[10px] text-green">확정</span>
                  )}
                  {unit.confirmedAt && unit.isDirty && (
                    <span className="ml-1 rounded bg-amber-t px-1 text-[10px] text-amber">재확정 필요</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-extrabold text-t1">
                  {won(displayTotal)}
                </td>
                {columns.map((c) => {
                  const cell = chargeDrafts?.[c.feeItemId] ?? unit.charges[c.feeItemId] ?? { charged: true, amount: 0 };
                  return (
                    <td key={c.feeItemId} className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          aria-label={`${unit.unitNo} ${c.name} 부과`}
                          checked={cell.charged}
                          disabled={unit.isVacant}
                          onChange={(e) =>
                            onChargeChange(unit.unitId, c.feeItemId, { charged: e.target.checked })
                          }
                        />
                        <input
                          type="number"
                          aria-label={`${unit.unitNo} ${c.name} 금액`}
                          value={String(cell.amount)}
                          disabled={unit.isVacant || !cell.charged}
                          onChange={(e) =>
                            onChargeChange(unit.unitId, c.feeItemId, { amount: Number(e.target.value) || 0 })
                          }
                          className="h-8 w-24 rounded border border-line px-2 text-right disabled:bg-line2"
                        />
                      </div>
                    </td>
                  );
                })}
                <td className="px-3 py-2">
                  <button
                    type="button"
                    aria-label={`${unit.unitNo} 메모`}
                    onClick={() => onNoteClick(unit.unitId)}
                    disabled={unit.isVacant}
                    className="rounded border border-line px-2 py-1 text-xs text-t2 hover:bg-line2"
                  >
                    메모{hasNote ? " ●" : ""}
                  </button>
                </td>
              </tr>
  );
});
