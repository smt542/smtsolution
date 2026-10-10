import { z } from "zod";
import { optionalTrimmedString } from "./common";
import { checkPasswordConfirm } from "./password";

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

/** 비밀번호 + 확인. 계정 정보 객체와 분리해 `.and()`로 합친다(불일치가 다른 칸 오류에 가려지지 않게). */
function passwordFields(required: boolean, confirmRequiredMessage: string) {
  return z.object({
    password: z.string(),
    passwordConfirm: z.string(),
  }).superRefine((values, ctx) => {
    checkPasswordConfirm(ctx, {
      password: values.password,
      confirm: values.passwordConfirm,
      passwordPath: "password",
      confirmPath: "passwordConfirm",
      required,
      confirmRequiredMessage,
    });
  });
}

export const accountCreateSchema = z.object({
  username: z.string().trim().min(1, "아이디를 입력해 주세요").max(50, "아이디는 50자 이하로 입력해 주세요"),
  ...base,
}).and(passwordFields(true, "비밀번호를 한 번 더 입력해 주세요"));
/** 수정: 비밀번호 변경·확인 — 둘 다 비우면 그대로, 입력하면 임시 비밀번호로 재설정 */
export const accountEditSchema = z.object({
  username: z.string().trim().max(50, "아이디는 50자 이하로 입력해 주세요").optional(),
  ...base,
}).and(passwordFields(false, "비밀번호를 한 번 더 입력해 주세요"));

export type AccountCreateInput = z.input<typeof accountCreateSchema>;
export type AccountCreateValues = z.output<typeof accountCreateSchema>;
export type AccountEditInput = z.input<typeof accountEditSchema>;
export type AccountEditValues = z.output<typeof accountEditSchema>;
