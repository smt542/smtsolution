import { createClient } from "@/lib/supabase/client";

export type MessagePointChannel = "sms" | "alimtalk";
export type PointReservationStatus =
  | "reserved"
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

  const { data, error } = await createClient().rpc(
    "platform_set_message_point_rates",
    {
      p_sms_points: input.smsPoints,
      p_alimtalk_points: input.alimtalkPoints,
    },
  );
  if (error) throw new Error(error.message);
  if (!(data as { ok?: boolean } | null)?.ok) {
    throw new Error("메시지 단가 변경에 실패했습니다.");
  }
}

export async function listPointReservations(
  status?: PointReservationStatus,
): Promise<PointReservation[]> {
  const { data, error } = await createClient().rpc(
    "platform_list_point_reservations",
    { p_status: status ?? null },
  );
  if (error) throw new Error(error.message);

  return ((data ?? []) as PointReservationRow[]).map((row) => ({
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
  }));
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
