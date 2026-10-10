import { createClient } from "@/lib/supabase/client";

export type AuditLogCategory =
  | "login"
  | "payment"
  | "account"
  | "data"
  | "resident"
  | "platform"
  | "other";

export const AUDIT_LOG_CATEGORY_LABELS: Record<AuditLogCategory, string> = {
  login: "로그인",
  payment: "수납·부과",
  account: "계정·권한",
  data: "건물·입주자",
  resident: "입주민",
  platform: "플랫폼",
  other: "기타",
};

/** audit_log.action → 화면 표시명. 없는 코드는 원문을 그대로 보인다. */
export const AUDIT_LOG_ACTION_LABELS: Record<string, string> = {
  LOGIN: "로그인",
  PAYMENT_RECORD: "수납 등록",
  PAYMENT_EDIT: "수납 수정",
  PAYMENT_CANCEL: "수납 삭제",
  PAYMENT_RESTORE: "수납 되살리기",
  PAYMENT_BANK_IMPORT: "은행 입금 업로드",
  PAYMENT_GIRO_IMPORT: "지로 수납 업로드",
  BILL_ISSUE: "고지서 발행",
  BILL_DELIVERY: "고지서 발송",
  BILLING_CONFIRM: "부과 확정",
  BILLING_CHARGE_NEW: "신규 부과",
  UTILITY_CONFIRM: "공과금 확정",
  SETTLEMENT_AUTOCOLLECT: "이사정산 자동수납",
  SETTLEMENT_OCCUPANCY_REUSED: "이사정산 세대 재사용",
  LONG_TERM_REPAIR_LEDGER_CREATE: "장기수선 원장 등록",
  LONG_TERM_REPAIR_LEDGER_UPDATE: "장기수선 원장 수정",
  LONG_TERM_REPAIR_LEDGER_DELETE: "장기수선 원장 삭제",
  ACCOUNT_CREATE: "계정 생성",
  ACCOUNT_UPDATE: "계정 수정",
  ACCOUNT_DELETE: "계정 삭제",
  ACCOUNT_ACTIVATE: "계정 활성화",
  ACCOUNT_DEACTIVATE: "계정 정지",
  ACCOUNT_PASSWORD_RESET: "비밀번호 재설정",
  PERMISSION_CHANGE: "권한 변경",
  PLATFORM_ACCOUNT_UPDATE: "본사 계정 수정",
  PLATFORM_ADMIN_MEMBER: "본사 관리자 지정",
  INSERT_BUILDINGS: "건물 등록",
  UPDATE_BUILDINGS: "건물 수정",
  DELETE_BUILDINGS: "건물 삭제",
  INSERT_UNITS: "호실 등록",
  UPDATE_UNITS: "호실 수정",
  DELETE_UNITS: "호실 삭제",
  INSERT_OCCUPANCIES: "입주자 등록",
  UPDATE_OCCUPANCIES: "입주자 수정",
  DELETE_OCCUPANCIES: "입주자 삭제",
  INSERT_LEASE_CONTRACTS: "임대계약 등록",
  UPDATE_LEASE_CONTRACTS: "임대계약 수정",
  DELETE_LEASE_CONTRACTS: "임대계약 삭제",
  INSERT_UNIT_ACCOUNTS: "세대 계좌 등록",
  UPDATE_UNIT_ACCOUNTS: "세대 계좌 수정",
  DELETE_UNIT_ACCOUNTS: "세대 계좌 삭제",
  INSERT_UNIT_METERS: "계량기 등록",
  UPDATE_UNIT_METERS: "계량기 수정",
  DELETE_UNIT_METERS: "계량기 삭제",
  INSERT_UNIT_PROPERTY_LISTINGS: "매물 등록",
  UPDATE_UNIT_PROPERTY_LISTINGS: "매물 수정",
  DELETE_UNIT_PROPERTY_LISTINGS: "매물 삭제",
  EXPORT_CSV: "CSV 내보내기",
  EXPORT_XLSX: "엑셀 내보내기",
  COMPLAINT_PARTNER_UPDATE: "A/S 협력사 처리",
  CLAIM_LINK: "입주민 세대 연결",
  CLAIM_LINK_REDUNDANT: "입주민 세대 중복 연결",
  CLAIM_REJECT: "입주민 연결 거절",
  CLAIM_UNLINK_MOVE_OUT: "퇴거로 연결 해제",
  RESIDENT_WITHDRAW: "입주민 탈퇴",
  ORG_CREATE: "테넌트 생성",
  ORG_CONTRACT_UPDATE: "테넌트 계약 수정",
  PLATFORM_SETTINGS_UPDATE: "플랫폼 설정 변경",
  PLATFORM_BILLING_MARK_PAID: "청구 입금 확인",
  PLATFORM_BILLING_REVERT_TO_UNPAID: "청구 미입금 되돌림",
  PLATFORM_POINT_CHARGE_UPDATE: "포인트 충전 수정",
  PLATFORM_POINT_CHARGE_DELETE: "포인트 충전 삭제",
  MESSAGE_POINT_RATE_UPDATE: "발송 단가 변경",
  MESSAGE_POINT_RESERVATION_RELEASE: "포인트 예약 해제",
};

export function auditLogActionLabel(action: string): string {
  return AUDIT_LOG_ACTION_LABELS[action] ?? action;
}

export interface PlatformAuditLog {
  id: number;
  createdAt: string;
  orgId: number | null;
  orgName: string | null;
  actorId: string | null;
  actorUsername: string | null;
  actorName: string | null;
  action: string;
  category: AuditLogCategory;
  tableName: string | null;
  rowPk: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
}

export interface PlatformAuditLogQuery {
  search?: string;
  category?: AuditLogCategory | null;
  /** YYYY-MM-DD (KST, 포함) */
  from?: string | null;
  /** YYYY-MM-DD (KST, 포함) */
  to?: string | null;
  page?: number;
  pageSize?: number;
}

interface AuditLogRpcRow {
  id: number;
  created_at: string;
  org_id: number | null;
  org_name: string | null;
  actor_id: string | null;
  actor_username: string | null;
  actor_name: string | null;
  action: string;
  category: AuditLogCategory;
  table_name: string | null;
  row_pk: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  total_count: number | string;
}

/** HQ 감사 로그 목록(platform_admin 전용 RPC). 최신순·페이지 단위. */
export async function listPlatformAuditLogs(
  opts: PlatformAuditLogQuery = {},
): Promise<{ rows: PlatformAuditLog[]; totalCount: number }> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(Math.max(1, Math.floor(opts.pageSize ?? 20)), 100);
  const { data, error } = await createClient().rpc("platform_list_audit_logs", {
    p_search: opts.search?.trim() || null,
    p_category: opts.category || null,
    p_from: opts.from || null,
    p_to: opts.to || null,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as AuditLogRpcRow[];
  return {
    rows: rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      orgId: row.org_id,
      orgName: row.org_name,
      actorId: row.actor_id,
      actorUsername: row.actor_username,
      actorName: row.actor_name,
      action: row.action,
      category: row.category,
      tableName: row.table_name,
      rowPk: row.row_pk,
      before: row.before,
      after: row.after,
      ip: row.ip,
    })),
    totalCount: rows.length > 0 ? Number(rows[0].total_count) : 0,
  };
}
