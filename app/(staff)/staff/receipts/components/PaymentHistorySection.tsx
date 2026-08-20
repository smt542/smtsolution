"use client";

import { Panel, Spinner } from "@/components/common";
import type { UnitPayment } from "@/hooks/reactquery/payments";
import type { ReceiptPaymentRow } from "@/hooks/reactquery/receipts";
import { toMonthInput } from "@/lib/billing/period";
import {
  PAYMENT_KIND_LABEL,
  PAYMENT_METHOD_LABEL,
  formatCurrency,
  formatDate,
} from "../receiptFormat";

const COLS = [
  "처리",
  "년월",
  "당월계",
  "연체",
  "수납액",
  "수료",
  "수납일자",
  "은행",
  "구분",
  "비고",
  "기한",
];

export function PaymentHistorySection({
  hasUnit,
  isLoading,
  payments,
  summary,
  period,
}: {
  hasUnit: boolean;
  isLoading: boolean;
  payments: UnitPayment[];
  summary: ReceiptPaymentRow | undefined;
  period: string;
}) {
  const ym = toMonthInput(period);
  const active = payments.filter((p) => p.status === "active");
  const paidTotal = active.reduce((sum, p) => sum + p.amount, 0);
  const unpaid = summary?.unpaid ?? null;

  return (
    <Panel title="수납 이력">
      {!hasUnit ? (
        <p className="py-10 text-center text-sm text-t4">호수를 선택해 주세요</p>
      ) : isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg text-left text-xs font-bold text-t3">
                  {COLS.map((col) => (
                    <th key={col} className="whitespace-nowrap px-3 py-2">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-t3">-</td>
                    <td className="px-3 py-3 num">{ym}</td>
                    <td className="px-3 py-3 text-right num">{formatCurrency(summary?.charged ?? null)}</td>
                    <td className="px-3 py-3 text-right text-red num">{formatCurrency(unpaid)}</td>
                    <td className="px-3 py-3 text-right num">-</td>
                    <td className="px-3 py-3 text-right num">-</td>
                    <td className="px-3 py-3">-</td>
                    <td className="px-3 py-3">-</td>
                    <td className="px-3 py-3">-</td>
                    <td className="px-3 py-3">-</td>
                    <td className="whitespace-nowrap px-3 py-3">{formatDate(summary?.dueDate ?? null)}</td>
                  </tr>
                ) : (
                  active.map((p, i) => (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-3 text-t3">{PAYMENT_KIND_LABEL[p.kind] ?? p.kind}</td>
                      <td className="px-3 py-3 num">{ym}</td>
                      <td className="px-3 py-3 text-right num">
                        {i === 0 ? formatCurrency(summary?.charged ?? null) : ""}
                      </td>
                      <td className="px-3 py-3 text-right text-red num">
                        {i === 0 ? formatCurrency(unpaid) : ""}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold num">{formatCurrency(p.amount)}</td>
                      <td className="px-3 py-3 text-right num">-</td>
                      <td className="whitespace-nowrap px-3 py-3">{formatDate(p.paidAt)}</td>
                      <td className="px-3 py-3">{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</td>
                      <td className="px-3 py-3">{PAYMENT_KIND_LABEL[p.kind] ?? p.kind}</td>
                      <td className="px-3 py-3 text-t2">{p.memo ?? "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {i === 0 ? formatDate(summary?.dueDate ?? null) : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-end gap-4 rounded-xl border border-line bg-bg px-4 py-3 text-sm">
            <span className="text-t3">
              수납액 합계 <b className="num text-t1">{formatCurrency(paidTotal)}</b>
            </span>
            <span className="text-t3">
              미납 <b className="num text-red">{formatCurrency(unpaid)}</b>
            </span>
            <span className="text-t3">
              미납합계 <b className="num text-red">{formatCurrency(unpaid)}</b>
            </span>
            <button
              type="button"
              disabled
              title="미납 안내 문자는 다음 단계(P2)에서 연결됩니다"
              className="cursor-not-allowed rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-t4"
            >
              문자 전송
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}
