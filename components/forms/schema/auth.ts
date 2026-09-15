import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "아이디를 입력해 주세요"),
  password: z.string().min(1, "비밀번호를 입력해 주세요"),
  autoLogin: z.boolean().default(false),
});

export type LoginFormInput = z.input<typeof loginSchema>;
export type LoginFormValues = z.output<typeof loginSchema>;
