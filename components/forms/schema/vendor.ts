import { z } from "zod";
import { nullableTrimmedString } from "./common";

export const vendorSchema = z.object({
  name: z.string().trim().min(1, "업체명을 입력해 주세요").max(100, "업체명은 100자 이하로 입력해 주세요"),
  manager: nullableTrimmedString(50, "담당자는 50자 이하로 입력해 주세요"),
  phone: nullableTrimmedString(30, "전화번호는 30자 이하로 입력해 주세요"),
  bankAccount: nullableTrimmedString(100, "계좌번호는 100자 이하로 입력해 주세요"),
  memo: nullableTrimmedString(1000, "비고는 1,000자 이하로 입력해 주세요"),
  categoryId: z.union([
    z.number({ invalid_type_error: "구분을 선택해 주세요" }).int().positive("구분을 선택해 주세요"),
    z.null(),
  ]).refine((value): value is number => value !== null, "구분을 선택해 주세요"),
});

export type VendorFormInput = z.input<typeof vendorSchema>;
export type VendorFormValues = z.output<typeof vendorSchema>;
