import { z } from "zod";

export const STAFF_TYPES = ["manager_staff", "field_staff", "support_staff", "tenant"] as const;

const base = {
  fullName: z.string().min(1, "이름을 입력해 주세요"),
  phone: z.string().optional(),
  phoneSub: z.string().optional(),
  staffType: z.enum(STAFF_TYPES),
  isMaster: z.boolean().default(false),
  isActive: z.boolean().default(true),
  affiliation: z.string().optional(),
  permissions: z.array(z.string()).default([]),
  roleIds: z.array(z.number()).default([]),
  alsoCrossApp: z.boolean().default(false),
};

const pinSchema = z.string().regex(/^\d{4}$/, "비밀번호는 숫자 4자리를 입력해 주세요");

export const accountCreateSchema = z.object({
  username: z.string().min(1, "아이디를 입력해 주세요"),
  password: pinSchema,
  ...base,
});
export const accountEditSchema = z.object({
  username: z.string().optional(),
  password: z.union([z.literal(""), pinSchema]).optional(),
  ...base,
});

export type AccountCreateValues = z.infer<typeof accountCreateSchema>;
export type AccountEditValues = z.infer<typeof accountEditSchema>;
