import { z } from "zod";

export const POINT_ADJUSTMENT_KINDS = ["correction", "deduction", "refund"] as const;

const optionalAmountKrw = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().min(0, "환불액은 0 이상이어야 합니다").optional(),
);

export const pointAdjustmentSchema = z
  .object({
    orgId: z.coerce.number().int().positive("조직을 선택해 주세요"),
    kind: z.enum(POINT_ADJUSTMENT_KINDS),
    points: z.coerce
      .number()
      .int("포인트는 정수로 입력해 주세요")
      .refine((value) => value !== 0, "조정 포인트는 0이 아니어야 합니다"),
    amountKrw: optionalAmountKrw,
    memo: z
      .string()
      .trim()
      .min(1, "조정 사유를 입력해 주세요")
      .max(200, "조정 사유는 200자 이하로 입력해 주세요"),
  })
  .superRefine((value, ctx) => {
    if (value.kind !== "correction" && value.points >= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["points"],
        message: "차감·환불 포인트는 음수로 입력해 주세요",
      });
    }
  });

export type PointAdjustmentFormValues = z.output<typeof pointAdjustmentSchema>;
