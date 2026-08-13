"use client";
import React from "react";
import type { BillingUnitRow, BillingColumn } from "@/lib/billing/pivot";
import { unitTotal, type ChargeLine } from "@/lib/billing/total";

interface BillingTableProps {
  units: BillingUnitRow[];
  columns: BillingColumn[];
  period: string;
  onChargeChange: (unitId: number, feeItemId: number, patch: { charged?: boolean; amount?: number }) => void;
  onRowClick: (unitId: number) => void;
  onNoteClick: (unitId: number) => void;
}

const won = (n: number) => n.toLocaleString("ko-KR");

function isMidMoveIn(moveInDate: string | null, period: string): boolean {
  return !!moveInDate && moveInDate.slice(0, 7) === period.slice(0, 7);
}

function rowTotal(u: BillingUnitRow, columns: BillingColumn[], period: string): number {
  if (u.isVacant) return 0;
  const lines: ChargeLine[] = columns.map((c) => {
    const cell = u.charges[c.feeItemId] ?? { charged: true, amount: 0 };
    return { charged: cell.charged, amount: cell.amount, dailyProration: c.dailyProration, rounding: c.rounding };
  });
  return unitTotal(lines, u.moveInDate, period);
}

export function BillingTable({ units, columns, period, onChargeChange, onRowClick, onNoteClick }: BillingTableProps) {
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
          {units.map((u) => {
            const mid = isMidMoveIn(u.moveInDate, period);
            return (
              <tr
                key={u.unitId}
                className={`border-b border-line2 ${mid ? "bg-blue-t" : ""} ${u.isVacant ? "text-t3" : ""}`}
              >
                <td
                  className="cursor-pointer px-3 py-2 font-semibold text-blue-d"
                  onClick={() => onRowClick(u.unitId)}
                >
                  {u.unitNo}
                </td>
                <td className="px-3 py-2">{u.roomTypeLabel ?? "-"}</td>
                <td className="px-3 py-2">
                  {u.isVacant ? (
                    <span className="font-semibold">공실</span>
                  ) : (
                    u.moveInDate ?? "-"
                  )}
                  {u.confirmedAt && !u.isDirty && (
                    <span className="ml-1 rounded bg-green-t px-1 text-[10px] text-green">확정</span>
                  )}
                  {u.confirmedAt && u.isDirty && (
                    <span className="ml-1 rounded bg-amber-t px-1 text-[10px] text-amber">재확정 필요</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-extrabold text-t1">
                  {won(rowTotal(u, columns, period))}
                </td>
                {columns.map((c) => {
                  const cell = u.charges[c.feeItemId] ?? { charged: true, amount: 0 };
                  return (
                    <td key={c.feeItemId} className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          aria-label={`${u.unitNo} ${c.name} 부과`}
                          checked={cell.charged}
                          disabled={u.isVacant}
                          onChange={(e) =>
                            onChargeChange(u.unitId, c.feeItemId, { charged: e.target.checked })
                          }
                        />
                        <input
                          type="number"
                          aria-label={`${u.unitNo} ${c.name} 금액`}
                          value={String(cell.amount)}
                          disabled={u.isVacant || !cell.charged}
                          onChange={(e) =>
                            onChargeChange(u.unitId, c.feeItemId, { amount: Number(e.target.value) || 0 })
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
                    aria-label={`${u.unitNo} 메모`}
                    onClick={() => onNoteClick(u.unitId)}
                    disabled={u.isVacant}
                    className="rounded border border-line px-2 py-1 text-xs text-t2 hover:bg-line2"
                  >
                    메모{u.billingNote || u.unitNotice ? " ●" : ""}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
