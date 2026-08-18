import { z } from "zod";

export const PLATFORM_ACCOUNT_ROLES = ["org_owner", "manager", "staff"] as const;
export const PLATFORM_ACCOUNT_STAFF_TYPES = [
  "manager_staff",
  "field_staff",
  "support_staff",
] as const;

export const platformAccountCreateSchema = z.object({
  orgId: z.coerce.number().int().positive("대상 조직을 선택해 주세요"),
  username: z.string().trim().min(1, "아이디를 입력해 주세요").max(50),
  password: z
    .string()
    .min(4, "비밀번호는 4자 이상 입력해 주세요")
    .optional()
    .or(z.literal("")),
  fullName: z.string().trim().min(1, "이름을 입력해 주세요").max(50),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  role: z.enum(PLATFORM_ACCOUNT_ROLES),
  staffType: z.enum(PLATFORM_ACCOUNT_STAFF_TYPES),
});

export type PlatformAccountCreateValues = z.output<typeof platformAccountCreateSchema>;
