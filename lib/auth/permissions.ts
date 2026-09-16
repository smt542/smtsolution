import type { MyContext } from "@/hooks/reactquery/auth/apis";

/**
 * 직원 기능별 권한 모듈 키 — PRD 정본 체크리스트 기준
 * (docs/superpowers/specs/2026-08-10-prd-synthesis.md §C.3).
 * org_owner(마스터)는 전체 통과.
 */
export const MODULE_KEYS = [
  "buildings",    // 건물 등록·수정
  "tenants",      // 입주자 등록·수정
  "utilities",    // 지침·부과 입력
  "billing",      // 부과 확정
  "fee_items",    // 항목등록 관리
  "bill_publish", // 서류 발행·출력
  "payment",      // 수납 처리
  "overdue",      // 미납 관리
  "vendors",      // 협력업체 관리
  "long_term_repair", // 장기수선비 관리
  "moving",       // 이사정산
  "messaging",    // 문자 발송
  "accounts",     // 계정 관리
  "settings",     // 설정 변경(셋업)
  "notices",      // 공지 관리
  "complaints",   // 민원·AS 관리
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  buildings: "건물 등록·수정",
  tenants: "입주자 등록·수정",
  utilities: "지침·부과",
  billing: "부과 확정",
  fee_items: "항목등록 관리",
  bill_publish: "서류 발행·출력",
  payment: "수납 처리",
  overdue: "미납 관리",
  vendors: "협력업체 관리",
  long_term_repair: "장기수선비 관리",
  moving: "이사정산",
  messaging: "문자 발송",
  accounts: "계정 관리",
  settings: "설정 변경",
  notices: "공지 관리",
  complaints: "민원·AS",
};

export function isMaster(role?: string | null): boolean {
  return role === "org_owner" || role === "platform_admin";
}

/** 해당 모듈 사용 가능? org_owner/platform_admin은 무조건 true. */
export function hasModule(ctx: MyContext | null | undefined, key: ModuleKey): boolean {
  if (!ctx) return false;
  if (isMaster(ctx.role)) return true;
  return (ctx.permissions ?? []).includes(key);
}

/** 계정·직원 관리 접근 가능? (마스터 또는 accounts 권한 보유) */
export function canManageAccounts(ctx: MyContext | null | undefined): boolean {
  return hasModule(ctx, "accounts");
}

/** 셋업 설정 변경 가능? (마스터 또는 settings 권한 보유) */
export function canManageSettings(ctx: MyContext | null | undefined): boolean {
  return hasModule(ctx, "settings");
}
