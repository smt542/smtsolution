import { z } from "zod";
import { nullableTrimmedString, requiredDate } from "./common";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{2,30}$/, "회사코드는 영문 소문자·숫자·하이픈 2~30자입니다");

const contractFields = {
  phone: z.string().trim().min(1, "대표 연락처를 입력해 주세요").max(20),
  contractStartDate: requiredDate("계약 시작일을 입력해 주세요"),
  contractEndDate: requiredDate("계약 만료일을 입력해 주세요"),
  representativeName: z.string().trim().min(1, "대표자명을 입력해 주세요").max(50),
  businessRegistrationNumber: z
    .string()
    .trim()
    .regex(/^\d{3}-\d{2}-\d{5}$/, "사업자등록번호는 000-00-00000 형식입니다"),
  fax: z.string().trim().min(1, "팩스 번호를 입력해 주세요").max(20),
  email: z.string().trim().email("올바른 이메일 주소를 입력해 주세요").max(254),
  address: z.string().trim().min(1, "주소를 입력해 주세요").max(300),
  region: z.string().trim().min(1, "지역을 입력해 주세요").max(100),
  operatingHours: nullableTrimmedString(100, "운영 시간은 100자 이하로 입력해 주세요"),
};

// 정본 신규 테넌트·상세 모달: 관리자 비밀번호 = 숫자 4자리(Auth 저장은 서버 toAuthPassword).
const OWNER_PIN = /^\d{4}$/;

function validateContractDates(
  values: { contractStartDate: string; contractEndDate: string },
  ctx: z.RefinementCtx,
) {
  if (values.contractStartDate && values.contractEndDate
    && values.contractEndDate < values.contractStartDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["contractEndDate"],
      message: "계약 만료일은 시작일 이후여야 합니다",
    });
  }
}

export const orgCreateSchema = z.object({
  name: z.string().trim().min(1, "회사명을 입력해 주세요").max(100),
  slug,
  ...contractFields,
  ownerUsername: z.string().trim().min(1, "관리자 아이디를 입력해 주세요").max(50),
  ownerPassword: z.string().trim().regex(OWNER_PIN, "비밀번호는 숫자 4자리입니다"),
}).superRefine(validateContractDates);
export type OrgCreateFormInput = z.input<typeof orgCreateSchema>;
export type OrgCreateFormValues = z.output<typeof orgCreateSchema>;

export const orgEditSchema = z.object({
  name: z.string().trim().min(1, "회사명을 입력해 주세요").max(100),
  slug,
  ...contractFields,
  /** 비우면 그대로, 숫자 4자리를 넣으면 관리자 비밀번호 변경 */
  ownerPassword: z
    .string()
    .trim()
    .refine((value) => value === "" || OWNER_PIN.test(value), "비밀번호는 숫자 4자리입니다"),
}).superRefine(validateContractDates);
export type OrgEditFormInput = z.input<typeof orgEditSchema>;
export type OrgEditFormValues = z.output<typeof orgEditSchema>;
