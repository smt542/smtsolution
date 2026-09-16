"use client";

import { Button, Spinner } from "@/components/common";
import { useBillDocuments } from "@/hooks/reactquery/bill";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  usePaymentReceiver,
  type PaymentRow,
  type UnitPayment,
} from "@/hooks/reactquery/payments";
import { PaymentReceiptPrintView } from "./PaymentReceiptPrintView";

interface PaymentReceiptModalProps {
  building: Building;
  companyName: string;
  row: PaymentRow;
  payment: UnitPayment;
  period: string;
  onClose: () => void;
}

function lateFeeFromItems(
  items: Array<{ name: string; charged: boolean; amount: number }> | undefined,
) {
  return (items ?? [])
    .filter((item) => item.charged && /연체|가산/.test(item.name))
    .reduce((sum, item) => sum + item.amount, 0);
}

export function PaymentReceiptModal({
  building,
  companyName,
  row,
  payment,
  period,
  onClose,
}: PaymentReceiptModalProps) {
  const billQuery = useBillDocuments(building.id, period, [row.unitId]);
  const receiverQuery = usePaymentReceiver(payment.id);
  const billDocument = billQuery.data?.find((document) => document.unitId === row.unitId);
  const lateFee = lateFeeFromItems(billDocument?.items);
  const isReceiptInitialLoading = billQuery.isLoading || receiverQuery.isLoading;
  const isReceiptRefreshing = [billQuery, receiverQuery]
    .some((query) => query.isFetching && !query.isLoading);
  const isReceiptBusy = isReceiptInitialLoading || isReceiptRefreshing;

  const receipt = (
    <PaymentReceiptPrintView
      building={building}
      companyName={companyName}
      row={row}
      payment={payment}
      period={period}
      lateFee={lateFee}
      receiverName={receiverQuery.data ?? null}
    />
  );

  return (
    <>
      <style>{"@media print { @page { size: A4 portrait; margin: 10mm; } }"}</style>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-3 print:hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-receipt-modal-title"
      >
        <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-surface shadow-pop">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <p className="text-xs font-bold text-brand">수납 이력 · 개별 출력</p>
              <h2 id="payment-receipt-modal-title" className="mt-0.5 text-xl font-extrabold text-t1">
                영수증 미리보기
              </h2>
            </div>
            <button
              type="button"
              aria-label="영수증 미리보기 닫기"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-t3 hover:bg-bg"
            >
              ×
            </button>
          </header>

          <main className="relative min-h-0 flex-1 overflow-auto bg-slate-200/70 p-5">
            {isReceiptInitialLoading ? (
              <div className="flex min-h-80 items-center justify-center"><Spinner label="수납 영수증 불러오는 중" /></div>
            ) : (
              <>
                {(billQuery.isError || receiverQuery.isError) && (
                  <p className="mx-auto mb-3 max-w-[190mm] rounded-lg bg-amber-t px-4 py-2 text-xs font-bold text-amber">
                    일부 부가정보를 불러오지 못해 확인 가능한 수납정보만 표시합니다.
                  </p>
                )}
                {receipt}
                {isReceiptRefreshing ? (
                  <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-surface/95 shadow-card">
                    <Spinner label="수납 영수증 갱신 중" size="small" showLabel className="px-3 py-2" />
                  </div>
                ) : null}
              </>
            )}
          </main>

          <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <Button type="button" variant="ghost" onClick={onClose}>닫기</Button>
            <Button type="button" onClick={() => window.print()} disabled={isReceiptBusy}>
              인쇄
            </Button>
          </footer>
        </div>
      </div>

      {!isReceiptInitialLoading && (
        <div className="hidden print:block" data-testid="payment-receipt-print-root">
          {receipt}
        </div>
      )}
    </>
  );
}
