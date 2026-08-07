import { z } from "zod";

export const vendorSchema = z.object({
  name: z.string().min(1, "업체명을 입력해 주세요"),
  phone: z.string().optional(),
  bankAccount: z.string().optional(),
  memo: z.string().optional(),
  categoryId: z.number().nullable().optional(),
});

export type VendorFormValues = z.infer<typeof vendorSchema>;
