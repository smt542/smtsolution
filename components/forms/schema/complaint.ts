import { z } from "zod";
import {
  nullableDate,
  nullableTrimmedString,
  requiredDate,
  requiredInteger,
} from "./common";

export const COMPLAINT_STATUSES = ["pending", "completed", "on_hold", "repeat"] as const;

const nullableTime = z.string().trim()
  .refine((value) => value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), "시간을 확인해 주세요")
  .transform((value) => value || null);

export const complaintFormSchema = z.object({
  buildingId: requiredInteger("건물을 선택해 주세요").pipe(z.number().positive("건물을 선택해 주세요")),
  unitId: requiredInteger("호수를 선택해 주세요").pipe(z.number().positive("호수를 선택해 주세요")),
  reporterName: nullableTrimmedString(100, "접수자는 100자 이하로 입력해 주세요"),
  assignedTo: nullableTrimmedString(100, "담당자를 확인해 주세요"),
  receivedDate: requiredDate("접수일시를 입력해 주세요"),
  categoryId: requiredInteger("유형을 선택해 주세요").pipe(z.number().positive("유형을 선택해 주세요")),
  reporterPhone: nullableTrimmedString(30, "전화번호는 30자 이하로 입력해 주세요"),
  content: z.string().trim().min(1, "접수내용을 입력해 주세요").max(5_000, "접수내용은 5,000자 이하로 입력해 주세요"),
  status: z.preprocess((value) => value === "" ? "pending" : value, z.enum(COMPLAINT_STATUSES)),
  resolvedDate: nullableDate("시행일자를 확인해 주세요"),
  resolvedTime: nullableTime,
  resultContent: nullableTrimmedString(5_000, "처리결과 내용은 5,000자 이하로 입력해 주세요"),
}).superRefine((value, ctx) => {
  if (value.resolvedTime && !value.resolvedDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["resolvedDate"],
      message: "시간을 입력하려면 시행일자를 선택해 주세요",
    });
  }
});

export type ComplaintFormInput = z.input<typeof complaintFormSchema>;
export type ComplaintFormValues = z.output<typeof complaintFormSchema>;
