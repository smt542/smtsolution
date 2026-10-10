import { z } from "zod";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULE_MESSAGE,
} from "@/lib/auth/passwordPolicy";

/** 계정 비밀번호: 형식 자유, 6자 이상(앞뒤 공백 포함 — trim 하지 않는다). */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_RULE_MESSAGE)
  .max(PASSWORD_MAX_LENGTH, `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하로 입력해 주세요.`);

/** 비우면 그대로 두는 비밀번호 변경 칸 */
export const optionalPasswordSchema = z.union([z.literal(""), passwordSchema]);

/**
 * 새 비밀번호 + 확인. 객체 refine은 칸 하나가 틀리면 건너뛰므로(zod 3), 원문 문자열로 받고
 * 규칙·일치를 superRefine에서 함께 본다 — 6자 미만이어도 불일치는 바로 표시된다.
 */
export const passwordChangeSchema = z
  .object({
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((values, ctx) => {
    const rule = passwordSchema.safeParse(values.newPassword);
    if (!rule.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: rule.error.issues[0]?.message ?? PASSWORD_RULE_MESSAGE,
      });
    }
    if (!values.confirmPassword) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "새 비밀번호를 한 번 더 입력해 주세요." });
    } else if (values.newPassword !== values.confirmPassword) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "새 비밀번호가 일치하지 않습니다." });
    }
  });

export type PasswordChangeInput = z.input<typeof passwordChangeSchema>;
export type PasswordChangeValues = z.output<typeof passwordChangeSchema>;
