import { z } from "zod";
import {
  emptyStringToUndefined,
  nullableTrimmedString,
  optionalTrimmedString,
  requiredInteger,
} from "./common";

export const PLATFORM_ACCOUNT_ROLES = ["org_owner", "manager", "staff"] as const;
export const PLATFORM_ACCOUNT_STAFF_TYPES = [
  "manager_staff",
  "field_staff",
  "support_staff",
] as const;

export const platformAccountCreateSchema = z.object({
  orgId: requiredInteger("대상 조직을 선택해 주세요").pipe(
    z.number().positive("대상 조직을 선택해 주세요"),
  ),
  username: z.string().trim().min(1, "아이디를 입력해 주세요").max(50),
  password: z.preprocess(
    emptyStringToUndefined,
    z.string().min(4, "비밀번호는 4자 이상 입력해 주세요").optional(),
  ),
  fullName: z.string().trim().min(1, "이름을 입력해 주세요").max(50),
  phone: optionalTrimmedString(20, "연락처는 20자 이하로 입력해 주세요"),
  role: z.enum(PLATFORM_ACCOUNT_ROLES),
  staffType: z.enum(PLATFORM_ACCOUNT_STAFF_TYPES),
});

export type PlatformAccountCreateInput = z.input<typeof platformAccountCreateSchema>;
export type PlatformAccountCreateValues = z.output<typeof platformAccountCreateSchema>;

export const platformAccountEditSchema = z.object({
  fullName: z.string().trim().min(1, "이름을 입력해 주세요").max(100, "이름은 100자 이하로 입력해 주세요"),
  phone: nullableTrimmedString(30, "전화번호는 30자 이하로 입력해 주세요"),
  memo: nullableTrimmedString(500, "메모는 500자 이하로 입력해 주세요"),
});

export type PlatformAccountEditInput = z.input<typeof platformAccountEditSchema>;
export type PlatformAccountEditValues = z.output<typeof platformAccountEditSchema>;
