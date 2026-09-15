import { z } from "zod";
import { nullableDate, nullableTrimmedString, requiredInteger } from "./common";

export const PAYMENT_METHODS = ["cash", "transfer", "auto_debit", "giro", "card", "other"] as const;

export const paymentAmountSchema = z.object({
  amount: requiredInteger("수납금액을 입력해 주세요").pipe(
    z.number().positive("수납금액은 0보다 커야 합니다"),
  ),
  method: z.enum(PAYMENT_METHODS),
  memo: nullableTrimmedString(500, "비고는 500자 이하로 입력해 주세요"),
  paidAt: nullableDate("수납일을 확인해 주세요"),
});

export type PaymentAmountInput = z.input<typeof paymentAmountSchema>;
export type PaymentAmountValues = z.output<typeof paymentAmountSchema>;
