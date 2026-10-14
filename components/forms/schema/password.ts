import { z } from "zod";
import {
  OFFICE_PIN_RULE_MESSAGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULE_MESSAGE,
  type PasswordRule,
} from "@/lib/auth/passwordPolicy";

/** 계정 비밀번호: 형식 자유, 6자 이상(앞뒤 공백 포함 — trim 하지 않는다). */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_RULE_MESSAGE)
  .max(PASSWORD_MAX_LENGTH, `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하로 입력해 주세요.`);

/** 사무실 관리자 계정 비밀번호: 숫자 4자리. */
export const officePinSchema = z.string().regex(/^\d{4}$/, OFFICE_PIN_RULE_MESSAGE);

export function passwordSchemaFor(rule: PasswordRule) {
  return rule === "officePin" ? officePinSchema : passwordSchema;
}

/**
 * 비밀번호 + 확인 칸 검사(superRefine 안에서 호출). 객체 refine은 다른 칸이 틀리면 건너뛰므로(zod 3)
 * 두 칸을 원문 문자열로 받는 별도 객체에서 부르고 `.and()`로 합친다 — 6자 미만·다른 칸 오류가
 * 있어도 불일치는 항상 표시된다. required=false(수정)면 둘 다 비울 때 그대로 둔다.
 */
export function checkPasswordConfirm(
  ctx: z.RefinementCtx,
  {
    password,
    confirm,
    passwordPath,
    confirmPath,
    required,
    confirmRequiredMessage,
    mismatchMessage = "비밀번호가 일치하지 않습니다",
    rule = "default",
  }: {
    password: string;
    confirm: string;
    passwordPath: string;
    confirmPath: string;
    required: boolean;
    confirmRequiredMessage: string;
    mismatchMessage?: string;
    /** officePin = 사무실 관리자 계정(숫자 4자리) */
    rule?: PasswordRule;
  },
) {
  if (!required && !password && !confirm) return;
  const checked = passwordSchemaFor(rule).safeParse(password);
  if (!checked.success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [passwordPath],
      message: checked.error.issues[0]?.message ?? PASSWORD_RULE_MESSAGE,
    });
  }
  if (!confirm) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [confirmPath], message: confirmRequiredMessage });
  } else if (password !== confirm) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [confirmPath], message: mismatchMessage });
  }
}

/** 비우면 그대로 두는 비밀번호 변경 칸 */
export const optionalPasswordSchema = z.union([z.literal(""), passwordSchema]);

/**
 * 새 비밀번호 + 확인. 객체 refine은 칸 하나가 틀리면 건너뛰므로(zod 3), 원문 문자열로 받고
 * 규칙·일치를 superRefine에서 함께 본다 — 6자 미만이어도 불일치는 바로 표시된다.
 */
export function passwordChangeSchemaFor(rule: PasswordRule) {
  return z
    .object({
      newPassword: z.string(),
      confirmPassword: z.string(),
    })
    .superRefine((values, ctx) => {
      checkPasswordConfirm(ctx, {
        password: values.newPassword,
        confirm: values.confirmPassword,
        passwordPath: "newPassword",
        confirmPath: "confirmPassword",
        required: true,
        confirmRequiredMessage: "새 비밀번호를 한 번 더 입력해 주세요.",
        mismatchMessage: "새 비밀번호가 일치하지 않습니다.",
        rule,
      });
    });
}

export const passwordChangeSchema = passwordChangeSchemaFor("default");

export type PasswordChangeInput = z.input<typeof passwordChangeSchema>;
export type PasswordChangeValues = z.output<typeof passwordChangeSchema>;
