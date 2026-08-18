import { z } from "zod";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{2,30}$/, "회사코드는 영문 소문자·숫자·하이픈 2~30자입니다");

export const orgCreateSchema = z.object({
  name: z.string().trim().min(1, "회사명을 입력해 주세요").max(100),
  slug,
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  ownerUsername: z.string().trim().min(1, "관리자 아이디를 입력해 주세요").max(50),
  ownerFullName: z.string().trim().min(1, "관리자 이름을 입력해 주세요").max(50),
  ownerPhone: z.string().trim().max(20).optional().or(z.literal("")),
});
export type OrgCreateFormValues = z.output<typeof orgCreateSchema>;

export const orgEditSchema = z.object({
  name: z.string().trim().min(1, "회사명을 입력해 주세요").max(100),
  slug,
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});
export type OrgEditFormValues = z.output<typeof orgEditSchema>;
