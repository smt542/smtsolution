import { createClient } from "@/lib/supabase/client";
import type { PaginatedResult } from "./apis";

export type MessagePointChannel = "sms" | "lms" | "alimtalk" | "fax";
export type PointReservationStatus =
  | "reserved"
  | "provider_pending"
  | "settled"
  | "released"
  | "reconcile_required";

export interface MessagePointRate {
  id: number;
  channel: MessagePointChannel;
  points: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface SetMessagePointRatesInput {
  smsPoints: number;
  alimtalkPoints: number;
  /** LMS 단가. 미설정(null)이면 LMS 단가를 변경하지 않는다. */
  lmsPoints?: number | null;
  /** 팩스 단가(장당). 미설정(null)이면 팩스 단가를 변경하지 않는다. */
  faxPoints?: number | null;
}

export interface PointReservation {
  id: number;
  orgId: number;
  organizationName: string;
  messageLogId: number;
  status: PointReservationStatus;
  reservedPoints: number;
  chargedPoints: number;
  ageSeconds: number;
  isReleasable: boolean;
  expiresAt: string;
  createdAt: string;
  requestedBy: string | null;
  requestedByName: string | null;
}

export interface PointReservationQuery {
  statuses?: PointReservationStatus[];
  page?: number;
  pageSize?: number;
}

export interface PointReservationPage extends PaginatedResult<PointReservation> {
  hasReconcileRequired: boolean;
}

interface MessagePointRateRow {
  id: number;
  channel: MessagePointChannel;
  points: number;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

interface PointReservationRow {
  id: number;
  org_id: number;
  organization_name: string;
  message_log_id: number;
  status: PointReservationStatus;
  reserved_points: number;
  charged_points: number;
  age_seconds: number;
  is_releasable: boolean;
  expires_at: string;
  created_at: string;
  requested_by: string | null;
  requested_by_name: string | null;
  total_count: number | string;
  has_reconcile_required: boolean;
}

export async function listMessagePointRates(
  includeHistory = false,
): Promise<MessagePointRate[]> {
  const { data, error } = await createClient().rpc(
    "platform_list_message_point_rates",
    { p_include_history: includeHistory },
  );
  if (error) throw new Error(error.message);

  return ((data ?? []) as MessagePointRateRow[]).map((row) => ({
    id: row.id,
    channel: row.channel,
    points: row.points,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

export async function setMessagePointRates(
  input: SetMessagePointRatesInput,
): Promise<void> {
  if (!Number.isInteger(input.smsPoints) || input.smsPoints <= 0) {
    throw new Error("SMS 단가는 1 이상의 정수여야 합니다.");
  }
  if (!Number.isInteger(input.alimtalkPoints) || input.alimtalkPoints <= 0) {
    throw new Error("알림톡 단가는 1 이상의 정수여야 합니다.");
  }
  if (
    input.lmsPoints != null &&
    (!Number.isInteger(input.lmsPoints) || input.lmsPoints <= 0)
  ) {
    throw new Error("LMS 단가는 1 이상의 정수여야 합니다.");
  }
  if (
    input.faxPoints != null &&
    (!Number.isInteger(input.faxPoints) || input.faxPoints <= 0)
  ) {
    throw new Error("팩스 단가는 1 이상의 정수여야 합니다.");
  }

  const { data, error } = await createClient().rpc(
    "platform_set_message_point_rates",
    {
      p_sms_points: input.smsPoints,
      p_alimtalk_points: input.alimtalkPoints,
      p_lms_points: input.lmsPoints ?? null,
      p_fax_points: input.faxPoints ?? null,
    },
  );
  if (error) throw new Error(error.message);
  if (!(data as { ok?: boolean } | null)?.ok) {
    throw new Error("메시지 단가 변경에 실패했습니다.");
  }
}

export async function listPointReservations(
  opts: PointReservationQuery = {},
): Promise<PointReservationPage> {
  const page = Number.isInteger(opts.page) && (opts.page ?? 0) > 0 ? opts.page as number : 1;
  const requestedPageSize = Number.isInteger(opts.pageSize) && (opts.pageSize ?? 0) > 0
    ? opts.pageSize as number
    : 25;
  const pageSize = Math.min(requestedPageSize, 100);
  const { data, error } = await createClient().rpc(
    "platform_list_point_reservations_page",
    {
      p_statuses: opts.statuses ?? null,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    },
  );
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as PointReservationRow[];
  return {
    rows: rows.map((row) => ({
      id: row.id,
      orgId: row.org_id,
      organizationName: row.organization_name,
      messageLogId: row.message_log_id,
      status: row.status,
      reservedPoints: row.reserved_points,
      chargedPoints: row.charged_points,
      ageSeconds: row.age_seconds,
      isReleasable: row.is_releasable,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      requestedBy: row.requested_by,
      requestedByName: row.requested_by_name,
    })),
    totalCount: rows.length > 0 ? Number(rows[0].total_count) : 0,
    page,
    pageSize,
    hasReconcileRequired: rows[0]?.has_reconcile_required ?? false,
  };
}

export async function releaseStalePointReservation(
  id: number,
  reason: string,
): Promise<void> {
  const normalizedReason = reason.trim();
  if (!normalizedReason) throw new Error("예약 해제 사유를 입력해 주세요.");

  const { data, error } = await createClient().rpc(
    "platform_release_stale_reservation",
    { p_id: id, p_reason: normalizedReason },
  );
  if (error) throw new Error(error.message);

  const result = data as { ok?: boolean; code?: string } | null;
  if (result?.ok) return;
  if (result?.code === "RESERVATION_NOT_STALE") {
    throw new Error("아직 만료되지 않은 예약은 해제할 수 없습니다.");
  }
  if (result?.code === "USAGE_ALREADY_RECORDED") {
    throw new Error("이미 사용 원장이 기록된 예약입니다.");
  }
  throw new Error("예약을 해제하지 못했습니다.");
}
