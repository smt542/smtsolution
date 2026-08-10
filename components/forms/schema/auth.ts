import { z } from "zod";

export const loginSchema = z.object({
  companyCode: z.string().min(1, "회사코드를 입력해 주세요"),
  username: z.string().min(1, "아이디를 입력해 주세요"),
  password: z.string().min(1, "비밀번호를 입력해 주세요"),
  autoLogin: z.boolean().default(false),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
