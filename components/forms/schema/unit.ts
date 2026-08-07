import { z } from "zod";

export const unitSchema = z.object({
  unitNo: z.string().min(1, "호실을 입력해 주세요"),
  dong: z.string().optional(),
  areaPyeong: z.number().optional(),
  roomCount: z.number().optional(),
  elecCustomerNo: z.string().optional(),
  elecMeterNo: z.string().optional(),
  waterCustomerNo: z.string().optional(),
  memo: z.string().optional(),
});

export type UnitFormValues = z.infer<typeof unitSchema>;
