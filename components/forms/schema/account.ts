import { z } from "zod";
import { optionalTrimmedString } from "./common";
import { optionalPasswordSchema, passwordSchema } from "./password";

export const STAFF_TYPES = ["manager_staff", "field_staff", "support_staff", "tenant"] as const;

const base = {
  fullName: z.string().trim().min(1, "이름을 입력해 주세요").max(100, "이름은 100자 이하로 입력해 주세요"),
  phone: optionalTrimmedString(30, "연락처는 30자 이하로 입력해 주세요"),
  phoneSub: optionalTrimmedString(30, "보조 연락처는 30자 이하로 입력해 주세요"),
  staffType: z.enum(STAFF_TYPES),
  isMaster: z.boolean().default(false),
  isActive: z.boolean().default(true),
  affiliation: optionalTrimmedString(100, "소속은 100자 이하로 입력해 주세요"),
  permissions: z.array(z.string()).default([]),
  roleIds: z.array(z.number()).default([]),
  alsoCrossApp: z.boolean().default(false),
};

export const accountCreateSchema = z.object({
  username: z.string().trim().min(1, "아이디를 입력해 주세요").max(50, "아이디는 50자 이하로 입력해 주세요"),
  password: passwordSchema,
  ...base,
});
export const accountEditSchema = z.object({
  username: z.string().trim().max(50, "아이디는 50자 이하로 입력해 주세요").optional(),
  password: optionalPasswordSchema.optional(),
  ...base,
});

export type AccountCreateInput = z.input<typeof accountCreateSchema>;
export type AccountCreateValues = z.output<typeof accountCreateSchema>;
export type AccountEditInput = z.input<typeof accountEditSchema>;
export type AccountEditValues = z.output<typeof accountEditSchema>;
