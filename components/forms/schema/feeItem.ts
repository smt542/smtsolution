import { z } from "zod";

export const feeItemSchema = z.object({
  name: z.string().trim().min(1, "항목명을 입력해 주세요").max(30, "항목명은 30자 이하로 입력해 주세요"),
  rounding: z.enum(["up", "round", "down", "raw"]).default("round"),
  dailyProration: z.boolean().default(false),
  carryOver: z.boolean().default(false),
  sortOrder: z.number().optional(),
  typeId: z.number().nullable().optional(),
});

export function createFeeItemSchema(existingNames: string[]) {
  const normalized = new Set(existingNames.map((name) => name.trim()));
  return feeItemSchema.refine((value) => !normalized.has(value.name), {
    path: ["name"],
    message: "이미 등록된 항목 명칭입니다.",
  });
}

export type FeeItemFormInput = z.input<typeof feeItemSchema>;
export type FeeItemFormValues = z.output<typeof feeItemSchema>;
