"use client";

import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Select } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import { setSubmissionError } from "@/components/forms/formErrors";
import {
  paymentAmountSchema,
  type PaymentAmountInput,
  type PaymentAmountValues,
} from "@/components/forms/schema/payment";
import type { PaymentKind, PaymentMethod, PaymentRow } from "@/hooks/reactquery/payments";
import { formatWon } from "@/lib/format";
import { ComplaintDialog } from "../ComplaintDialog";
import { KIND_LABEL, METHOD_OPTIONS } from "./constants";

interface PaymentAmountModalProps {
  open: boolean;
  row: PaymentRow;
  kind: PaymentKind;
  defaultAmount: number;
  defaultMethod?: PaymentMethod;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (value: PaymentAmountValues) => Promise<void>;
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
  const makeDefaults = useCallback((): PaymentAmountInput => ({
    amount: defaultAmount,
    method: defaultMethod ?? "transfer",
    memo: "",
    paidAt: today(),
  }), [defaultAmount, defaultMethod]);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PaymentAmountInput, unknown, PaymentAmountValues>({
    resolver: zodResolver(paymentAmountSchema),
    defaultValues: makeDefaults(),
    shouldFocusError: true,
  });
  const submitting = isPending || isSubmitting;
  const unitLabel = row.dong ? `${row.dong} ${row.unitNo}` : row.unitNo;
  const closeSafely = () => {
    if (!submitting) onClose();
  };

  useEffect(() => {
    reset(makeDefaults());
  }, [makeDefaults, reset]);

  const submit = async (values: PaymentAmountValues) => {
    try {
      await onSubmit(values);
      reset(makeDefaults());
      onClose();
    } catch (error) {
      setSubmissionError(error, setError, "수납 처리에 실패했습니다.");
    }
  };

  return (
    <ComplaintDialog open onClose={closeSafely} title={`${KIND_LABEL[kind]} 처리`} size="medium">
      <form className="space-y-5" onSubmit={handleSubmit(submit)} noValidate>
        <div className="rounded-xl bg-bg p-4">
          <p className="text-xs font-bold text-t3">호실</p>
          <p className="mt-1 font-extrabold text-t1">{unitLabel}</p>
          <p className="mt-1 text-sm text-t2">{row.isVacant ? "공실" : row.tenantName ?? "-"}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="payment-amount" label={<>수납금액 <span className="text-red">*</span></>} error={errors.amount?.message} className="space-y-2 text-sm font-bold text-t2">
            {kind === "partial" ? (
              <Input id="payment-amount" aria-label="수납금액" type="number" min="1" step="1" {...register("amount")} />
            ) : (
              <>
                <input type="hidden" {...register("amount")} />
                <div id="payment-amount" className="num flex h-11 items-center rounded-xl border border-line bg-bg px-4 text-t1">
                  {formatWon(defaultAmount)}
                </div>
              </>
            )}
          </FormField>

          <FormField htmlFor="payment-method" label="수납방법" error={errors.method?.message} className="space-y-2 text-sm font-bold text-t2">
            <Select id="payment-method" aria-label="수납방법" {...register("method")} options={METHOD_OPTIONS} />
          </FormField>

          <FormField htmlFor="payment-date" label="수납일" error={errors.paidAt?.message} className="space-y-2 text-sm font-bold text-t2">
            <Input id="payment-date" aria-label="수납일" type="date" {...register("paidAt")} />
          </FormField>

          <FormField htmlFor="payment-memo" label="비고" error={errors.memo?.message} className="space-y-2 text-sm font-bold text-t2">
            <Input id="payment-memo" aria-label="비고" {...register("memo")} placeholder="수납 관련 메모" />
          </FormField>
        </div>

        {errors.root?.server?.message && (
          <p role="alert" className="rounded-xl bg-red-t px-3 py-2 text-sm font-semibold text-red">{errors.root.server.message}</p>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="ghost" onClick={closeSafely} disabled={submitting}>닫기</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "처리 중…" : "수납 처리"}</Button>
        </div>
      </form>
    </ComplaintDialog>
  );
}

export function PaymentAmountModal(props: PaymentAmountModalProps) {
  if (!props.open) return null;
  return <PaymentAmountForm {...props} />;
}
