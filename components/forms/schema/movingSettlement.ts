import { z } from "zod";

const amountSchema = z.number().int().min(0).nullable();

export const movingSettlementSchema = z.object({
  moveOutDate: z.string().min(1, "퇴실일을 선택해 주세요"),
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
