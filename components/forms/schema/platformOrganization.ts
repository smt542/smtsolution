import { z } from "zod";
import { passwordSchema } from "./password";
import { nullableTrimmedString, requiredDate } from "./common";

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
  operatingHours: nullableTrimmedString(100, "운영 시간은 100자 이하로 입력해 주세요"),
};

// 관리자 비밀번호 = 형식 자유·6자 이상(2026-10-10). 발급 비밀번호는 임시라 첫 로그인 때 변경을 강제한다.

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

/**
 * 관리자 비밀번호 + 확인. 업체 정보 객체와 분리해 `.and()`로 합친다 — zod 3의 객체 superRefine은
 * 다른 칸이 하나라도 틀리면 건너뛰어, 확인 불일치가 안 뜨던 문제를 막는다.
 * required=false(수정)면 둘 다 비울 때 그대로 둔다.
 */
function ownerPasswordFields(required: boolean, confirmRequiredMessage: string) {
  return z.object({
    ownerPassword: z.string(),
    ownerPasswordConfirm: z.string(),
  }).superRefine((values, ctx) => {
    const { ownerPassword, ownerPasswordConfirm } = values;
    if (!required && !ownerPassword && !ownerPasswordConfirm) return;

    const rule = passwordSchema.safeParse(ownerPassword);
    if (!rule.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ownerPassword"],
        message: rule.error.issues[0]?.message ?? "비밀번호를 확인해 주세요",
      });
    }
    if (!ownerPasswordConfirm) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ownerPasswordConfirm"], message: confirmRequiredMessage });
    } else if (ownerPassword !== ownerPasswordConfirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ownerPasswordConfirm"],
        message: "비밀번호가 일치하지 않습니다",
      });
    }
  });
}

export const orgCreateSchema = z.object({
  name: z.string().trim().min(1, "회사명을 입력해 주세요").max(100),
  ...contractFields,
  ownerUsername: z.string().trim().min(1, "관리자 아이디를 입력해 주세요").max(50),
}).superRefine(validateContractDates)
  .and(ownerPasswordFields(true, "초기 비밀번호를 한 번 더 입력해 주세요"));
export type OrgCreateFormInput = z.input<typeof orgCreateSchema>;
export type OrgCreateFormValues = z.output<typeof orgCreateSchema>;

export const orgEditSchema = z.object({
  name: z.string().trim().min(1, "회사명을 입력해 주세요").max(100),
  ...contractFields,
}).superRefine(validateContractDates)
  /** 비우면 그대로, 입력하면 관리자 비밀번호를 임시 비밀번호로 재설정 */
  .and(ownerPasswordFields(false, "비밀번호를 한 번 더 입력해 주세요"));
export type OrgEditFormValues = z.output<typeof orgEditSchema>;

/**
 * 정본 목록의 지역(업체명 아래) = 주소 앞부분. 정본 모달엔 지역 칸이 없어 주소에서 뽑는다.
 * 시·도 + 둘째 조각이 시·군·구면 그것까지 — '대전 유성구 봉명동 …' → '대전 유성구',
 * '충북 청주시 흥덕구 …' → '충북 청주시', '세종특별자치시 한누리대로 …' → '세종특별자치시'.
 */
export function regionFromAddress(address: string): string {
  const [first = "", second = ""] = address.trim().split(/\s+/);
  return /[시군구]$/.test(second) ? `${first} ${second}` : first;
}
