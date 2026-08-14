"use client";

import { useState } from "react";
import { Button, Input, Select } from "@/components/common";
import type {
  PaymentKind,
  PaymentMethod,
  PaymentRow,
} from "@/hooks/reactquery/payments";
import { ComplaintDialog } from "../../receipts/components/ComplaintDialog";
import { KIND_LABEL, METHOD_OPTIONS } from "../constants";

interface PaymentAmountModalProps {
  open: boolean;
  row: PaymentRow;
  kind: PaymentKind;
  defaultAmount: number;
  defaultMethod?: PaymentMethod;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (value: {
    amount: number;
    method: PaymentMethod;
    memo: string | null;
    paidAt: string | null;
  }) => void;
}

function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function PaymentAmountForm({
  row,
  kind,
  defaultAmount,
  defaultMethod,
  isPending,
  onClose,
  onSubmit,
}: Omit<PaymentAmountModalProps, "open">) {
  const [amountInput, setAmountInput] = useState(String(defaultAmount));
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod ?? "transfer");
  const [memo, setMemo] = useState("");
  const [paidAt, setPaidAt] = useState(today);
  const amount = kind === "partial" ? Number(amountInput) : defaultAmount;
  const amountIsValid = Number.isFinite(amount) && amount > 0;
  const unitLabel = row.dong ? `${row.dong} ${row.unitNo}` : row.unitNo;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!amountIsValid || isPending) return;
    onSubmit({
      amount,
      method,
      memo: memo.trim() || null,
      paidAt: paidAt || null,
    });
  };

  return (
    <ComplaintDialog
      open
      onClose={onClose}
      title={`${KIND_LABEL[kind]} 처리`}
      size="medium"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="rounded-xl bg-bg p-4">
          <p className="text-xs font-bold text-t3">호실</p>
          <p className="mt-1 font-extrabold text-t1">{unitLabel}</p>
          <p className="mt-1 text-sm text-t2">{row.isVacant ? "공실" : row.tenantName ?? "-"}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-bold text-t2">
            수납금액 <span className="text-red">*</span>
            {kind === "partial" ? (
              <Input
                aria-label="수납금액"
                type="number"
                min="1"
                step="1"
                required
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
              />
            ) : (
              <div className="num flex h-11 items-center rounded-xl border border-line bg-bg px-4 text-t1">
                {defaultAmount.toLocaleString()}원
              </div>
            )}
          </label>

          <label className="space-y-2 text-sm font-bold text-t2">
            수납방법
            <Select
              aria-label="수납방법"
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
              options={METHOD_OPTIONS}
            />
          </label>

          <label className="space-y-2 text-sm font-bold text-t2">
            수납일
            <Input
              aria-label="수납일"
              type="date"
              value={paidAt}
              onChange={(event) => setPaidAt(event.target.value)}
            />
          </label>

          <label className="space-y-2 text-sm font-bold text-t2">
            비고
            <Input
              aria-label="비고"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="수납 관련 메모"
            />
          </label>
        </div>

        {!amountIsValid && (
          <p role="alert" className="text-sm font-semibold text-red">
            수납금액은 0보다 커야 합니다.
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            닫기
          </Button>
          <Button type="submit" disabled={isPending || !amountIsValid}>
            {isPending ? "처리 중…" : "수납 처리"}
          </Button>
        </div>
      </form>
    </ComplaintDialog>
  );
}

export function PaymentAmountModal(props: PaymentAmountModalProps) {
  if (!props.open) return null;

  return (
    <PaymentAmountForm
      row={props.row}
      kind={props.kind}
      defaultAmount={props.defaultAmount}
      defaultMethod={props.defaultMethod}
      isPending={props.isPending}
      onClose={props.onClose}
      onSubmit={props.onSubmit}
    />
  );
}
