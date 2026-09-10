"use client";

import { useEffect } from "react";
import type { BillDocument, BillTarget } from "@/hooks/reactquery/bill";
import { prevPeriod } from "@/lib/billing/period";
import {
  buildAdjustmentRows,
  buildOutputQrPayload,
  formatBillAmount,
} from "@/lib/bill/document";
import type { BillBuilding } from "../types";
import { QrCode } from "./QrCode";

export interface AdjustmentBuildingDocuments {
  building: BillBuilding;
  current: BillDocument[];
  previous: BillDocument[];
  targets: BillTarget[];
}

export interface AdjustmentPrintViewProps {
  companyName: string;
  period: string;
  buildings: AdjustmentBuildingDocuments[];
  onReady?: () => void;
}

function signedAmount(amount: number) {
  if (amount === 0) return "변동 없음";
  return `${amount > 0 ? "+" : "-"}${formatBillAmount(Math.abs(amount))}`;
}

export function AdjustmentPrintView({ companyName, period, buildings, onReady }: AdjustmentPrintViewProps) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  const previous = prevPeriod(period);
  const previousLabel = `${previous.slice(0, 4)}-${previous.slice(5, 7)}`;
  return (
    <div className="space-y-5 text-black" data-testid="adjustment-print-view">
      {buildings.map(({ building, current, previous, targets }) => {
        const rows = buildAdjustmentRows(current, previous);
        const autoDebitUnits = new Set(targets.filter((target) => target.autoDebit).map((target) => target.unitId));
        return (
          <article
            key={building.id}
            className="relative mx-auto min-h-[270mm] w-[190mm] overflow-hidden bg-white p-[10mm] shadow-sm print:break-after-page print:shadow-none"
          >
            <div className="pointer-events-none absolute inset-0 flex rotate-[-30deg] items-center justify-center text-6xl font-black text-slate-100">
              {companyName}
            </div>
            <div className="relative">
              <header className="flex items-start justify-between border-b-2 border-black pb-4">
                <div>
                  <p className="text-xs font-bold tracking-[0.2em]">BILLING ADJUSTMENT STATEMENT</p>
                  <h1 className="mt-1 text-2xl font-black">조정명세서</h1>
                  <p className="mt-2 text-sm font-bold">{building.name} · {period.slice(0, 4)}년 {Number(period.slice(5, 7))}월분</p>
                  <p className="mt-1 text-xs text-slate-600">전월 확정 부과 대비 당월 확정 부과 조정 내역</p>
                </div>
                <div className="text-center">
                  <QrCode value={buildOutputQrPayload("adjustment", building.id, period)} size={76} />
                  <p className="mt-1 text-[9px]">명세서 확인 QR</p>
                </div>
              </header>

              {rows.length === 0 ? (
                <div className="mt-8 border border-dashed border-slate-400 p-10 text-center text-sm text-slate-500">
                  비교할 확정 부과 자료가 없습니다.
                </div>
              ) : (
                <table className="mt-5 w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="border-y border-black bg-slate-100">
                      <th className="p-2 text-left">호수 / 세대주</th>
                      <th className="p-2 text-right">전월</th>
                      <th className="p-2 text-right">당월</th>
                      <th className="p-2 text-right">증감</th>
                      <th className="p-2 text-left">항목별 조정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const target = targets.find((candidate) => candidate.unitId === row.unitId);
                      const changedLines = row.lines.filter((line) => line.delta !== 0);
                      return (
                        <tr key={row.unitId} className="border-b border-slate-300 align-top">
                          <td className="p-2">
                            <strong>{row.dong ? `${row.dong} ` : ""}{row.unitNo}호</strong>
                            <span className="mt-0.5 block text-slate-600">{target?.payerName || row.tenantName || "-"}</span>
                            {(autoDebitUnits.has(row.unitId) || row.autoDebit) && <span className="mt-1 inline-block rounded border border-black px-1 font-bold">자동이체</span>}
                          </td>
                          <td className="p-2 text-right tabular-nums">{formatBillAmount(row.previousTotal)}</td>
                          <td className="p-2 text-right tabular-nums">{formatBillAmount(row.currentTotal)}</td>
                          <td className={`p-2 text-right font-black tabular-nums ${row.totalDelta > 0 ? "text-red-700" : row.totalDelta < 0 ? "text-blue-700" : ""}`}>
                            {signedAmount(row.totalDelta)}
                          </td>
                          <td className="p-2">
                            {changedLines.length === 0 ? "변동 없음" : changedLines.map((line) => (
                              <span key={line.feeItemId} className="block">{line.name} {signedAmount(line.delta)}</span>
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              <footer className="mt-6 flex justify-between border-t border-black pt-3 text-[10px]">
                <span>비교 기준 · {previousLabel} 전월 확정 스냅샷</span>
                <strong>{companyName}</strong>
              </footer>
            </div>
          </article>
        );
      })}
    </div>
  );
}
