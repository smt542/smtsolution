import { z } from "zod";

const amountSchema = z.number().int().min(0).nullable();
/** 지침·단가는 소수(수도 6.5㎥ 등)가 있어 정수로 제한하지 않는다. */
const readingSchema = z.number().min(0).nullable().optional();

export const movingSettlementSchema = z.object({
  moveOutDate: z.string().min(1, "퇴실일을 선택해 주세요"),
  // 이사 지침 정본(extra.util, 0266): 구분별 전월 지침 · 이사 지침 · 단가. 금액 = max(0, 이사−전월) × 단가.
  waterPrevReading: readingSchema,
  waterMoveReading: readingSchema,
  waterUnitPrice: readingSchema,
  elecPrevReading: readingSchema,
  elecMoveReading: readingSchema,
  elecUnitPrice: readingSchema,
  gasPrevReading: readingSchema,
  gasMoveReading: readingSchema,
  gasUnitPrice: readingSchema,
  mgmtFeeMonthly: amountSchema,
  mgmtFeeProrated: amountSchema,
  waterCharge: amountSchema,
  elecCharge: amountSchema,
  gasCharge: amountSchema,
  elecPaidDate: z.string().optional(),
  gasPaidDate: z.string().optional(),
  repairAmount: amountSchema,
  repairAttribution: z.enum(["owner", "manager", "office"]).nullable(),
  repairMemo: z.string().optional(),
  settleBank: z.string().optional(),
  settleAcct: z.string().optional(),
  settleHolder: z.string().optional(),
  note: z.string().optional(),
  settlementNote: z.string().optional(),
});

export type MovingSettlementValues = z.infer<typeof movingSettlementSchema>;
