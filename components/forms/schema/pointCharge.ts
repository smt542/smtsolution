import { z } from "zod";

export const pointChargeSchema = z.object({
  orgId: z.coerce.number().int().positive("조직을 선택해 주세요"),
  points: z.coerce.number().int().positive("충전 포인트는 1 이상이어야 합니다"),
  amountKrw: z.coerce.number().int().min(0, "결제금액은 0 이상이어야 합니다"),
  memo: z.string().max(200, "메모는 200자 이하로 입력해 주세요").optional(),
});

export type PointChargeFormValues = z.output<typeof pointChargeSchema>;
