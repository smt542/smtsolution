import { z } from "zod";

export const feeItemSchema = z.object({
  name: z.string().min(1, "항목명을 입력해 주세요"),
  rounding: z.enum(["up", "round", "down", "raw"]).default("round"),
  dailyProration: z.boolean().default(false),
  carryOver: z.boolean().default(false),
  sortOrder: z.number().optional(),
  typeId: z.number().nullable().optional(),
});

export type FeeItemFormValues = z.infer<typeof feeItemSchema>;
