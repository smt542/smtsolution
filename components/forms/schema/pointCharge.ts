import { z } from "zod";
import { optionalTrimmedString, requiredInteger } from "./common";

export const pointChargeSchema = z.object({
  orgId: requiredInteger("조직을 선택해 주세요").pipe(z.number().positive("조직을 선택해 주세요")),
  points: requiredInteger("충전 포인트를 입력해 주세요").pipe(
    z.number().positive("충전 포인트는 1 이상이어야 합니다"),
  ),
  amountKrw: requiredInteger("결제금액을 입력해 주세요").pipe(
    z.number().min(0, "결제금액은 0 이상이어야 합니다"),
  ),
  memo: optionalTrimmedString(200, "메모는 200자 이하로 입력해 주세요"),
});

export type PointChargeFormInput = z.input<typeof pointChargeSchema>;
export type PointChargeFormValues = z.output<typeof pointChargeSchema>;
