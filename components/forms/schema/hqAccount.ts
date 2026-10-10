import { z } from "zod";
import type { HqRole } from "@/hooks/reactquery/platform";
import { optionalPasswordSchema, passwordSchema } from "./password";

const HQ_ROLES = ["master", "operations", "support", "sales", "accounting", "other"] as const satisfies readonly HqRole[];

const PHONE_PATTERN = /^01\d-\d{3,4}-\d{4}$/;

const baseFields = {
  fullName: z.string().trim().min(1, "이름을 입력해 주세요").max(100, "이름은 100자 이하로 입력해 주세요"),
  hqRole: z.enum(HQ_ROLES, { errorMap: () => ({ message: "역할을 선택해 주세요" }) }),
  phone: z.string().trim().regex(PHONE_PATTERN, "전화번호를 010-0000-0000 형식으로 입력해 주세요"),
  memo: z.string().trim().max(500, "메모는 500자 이하로 입력해 주세요"),
  isActive: z.boolean(),
};

function validatePasswordConfirm(
  values: { password: string; passwordConfirm: string },
  ctx: z.RefinementCtx,
) {
  if (!values.password) return;
  if (!values.passwordConfirm) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["passwordConfirm"], message: "비밀번호를 한 번 더 입력해 주세요" });
  } else if (values.password !== values.passwordConfirm) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["passwordConfirm"], message: "비밀번호가 일치하지 않습니다" });
  }
}

/** 본사 계정 생성: 아이디·비밀번호·비밀번호 확인 필수 */
export const hqAccountCreateSchema = z
  .object({
    ...baseFields,
    username: z.string().trim().min(1, "아이디를 입력해 주세요").max(50, "아이디는 50자 이하로 입력해 주세요"),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .superRefine(validatePasswordConfirm);

/** 본사 계정 수정: 비밀번호는 바꿀 때만(비우면 그대로), 바꾸면 확인 칸 일치 필요 */
export const hqAccountEditSchema = z
  .object({
    ...baseFields,
    username: z.string(),
    password: optionalPasswordSchema,
    passwordConfirm: z.string(),
  })
  .superRefine(validatePasswordConfirm);

export type HqAccountFormValues = z.output<typeof hqAccountCreateSchema>;
