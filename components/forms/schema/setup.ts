import { z } from "zod";

export const setupBillingSchema = z.object({
  customerNotice: z.string().optional(),
  unitLabelDefault: z.enum(["code", "name"]),
  lateFeeMerge: z.boolean(),
  printUtilityCutoff: z.boolean(),
  printWaterUnitPrice: z.boolean(),
  printBillingPeriod: z.boolean(),
  printDelta: z.boolean(),
  showAsOnMain: z.boolean(),
  cutoffMonths: z.number().int().min(0).optional(),
});

export const setupAccountsSchema = z.object({
  mgmtBank1: z.string().optional(),
  mgmtAcct1: z.string().optional(),
  mgmtHolder1: z.string().optional(),
  mgmtPrint1: z.boolean(),
  mgmtBank2: z.string().optional(),
  mgmtAcct2: z.string().optional(),
  mgmtHolder2: z.string().optional(),
  mgmtPrint2: z.boolean(),
  settleBank: z.string().optional(),
  settleAcct: z.string().optional(),
  settleHolder: z.string().optional(),
});

export const setupSettlementSchema = z.object({
  waterUnitReflect: z.boolean(),
  electricUnitReflect: z.boolean(),
  vacancyPaymentMode: z.enum(["manual", "auto"]),
});

export const labelMasterSchema = z.object({
  label: z.string().min(1, "항목명을 입력해 주세요"),
});

export const quickMessageSchema = z.object({
  title: z.string().min(1, "제목을 입력해 주세요"),
  body: z.string().min(1, "내용을 입력해 주세요"),
});

export const longTermRepairSchema = z.object({
  workName: z.string().min(1, "공사명을 입력해 주세요"),
  workDate: z.string().optional(),
  amount: z.number().int().min(0).optional(),
  memo: z.string().optional(),
});

export type SetupBillingValues = z.infer<typeof setupBillingSchema>;
export type SetupAccountsValues = z.infer<typeof setupAccountsSchema>;
export type SetupSettlementValues = z.infer<typeof setupSettlementSchema>;
export type LabelMasterValues = z.infer<typeof labelMasterSchema>;
export type QuickMessageValues = z.infer<typeof quickMessageSchema>;
export type LongTermRepairValues = z.infer<typeof longTermRepairSchema>;
