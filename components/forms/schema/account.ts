import { z } from "zod";

export const STAFF_TYPES = ["manager_staff", "field_staff", "support_staff", "tenant"] as const;

const base = {
  fullName: z.string().min(1, "이름을 입력해 주세요"),
  phone: z.string().optional(),
  phoneSub: z.string().optional(),
  staffType: z.enum(STAFF_TYPES),
  isMaster: z.boolean().default(false),
  affiliation: z.string().optional(),
  permissions: z.array(z.string()).default([]),
  roleIds: z.array(z.number()).default([]),
};

export const accountCreateSchema = z.object({
  username: z.string().min(1, "아이디를 입력해 주세요"),
  password: z.string().min(4, "비밀번호는 4자 이상 입력해 주세요"),
  ...base,
});
export const accountEditSchema = z.object({ ...base });

export type AccountCreateValues = z.infer<typeof accountCreateSchema>;
export type AccountEditValues = z.infer<typeof accountEditSchema>;
