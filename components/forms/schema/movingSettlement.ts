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
  repairAttribution: z.enum(["owner", "manager", "office"]).nullable(),
  // ③ 기타(extra.etcItems, 0302): 항목명·금액, 최대 15개. 기타 소계 = 금액 합계(repair_amount 로 저장).
  etcItems: z
    .array(z.object({ name: z.string(), amount: amountSchema }))
    .min(1)
    .max(15),
  // 청소(0302): 금액은 cleaning_cost(전체 이사조회 청소비와 같은 원천), 나머지는 extra.cleaning.
  cleaningBy: z.string().optional(),
  cleaningStatus: z.enum(["완료", "미결"]),
  cleaningDoneDate: z.string().optional(),
  cleaningCost: amountSchema,
  cleaningAcct: z.string().optional(),
  cleaningNote: z.string().optional(),
  /** 가수금(extra.adv, 0302). */
  advance: amountSchema,
  settleBank: z.string().optional(),
  settleAcct: z.string().optional(),
  settleHolder: z.string().optional(),
  note: z.string().optional(),
  settlementNote: z.string().optional(),
});

export type MovingSettlementValues = z.infer<typeof movingSettlementSchema>;
