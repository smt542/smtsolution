import { createClient } from "@/lib/supabase/client";

export type ResidentMoveOutStatus =
  | "pending"
  | "confirmed"
  | "canceled"
  | "rejected"
  | "done";

export interface ResidentMoveOutRow {
  id: number;
  desired_date: string;
  reason: string | null;
  status: ResidentMoveOutStatus;
  created_at: string;
  updated_at: string;
  canceled_at: string | null;
  resolved_at: string | null;
}

export interface ResidentMoveOutRequest {
  id: number;
  desiredDate: string;
  reason: string | null;
  status: ResidentMoveOutStatus;
  createdAt: string;
  updatedAt: string;
  canceledAt: string | null;
  resolvedAt: string | null;
}

export interface CreateMoveOutInput {
  desiredDate: string;
  reason?: string | null;
}

export type ResidentMoveOutResult = ResidentMoveOutRequest | null;

type MoveOutRpcError = { code?: string; message: string };

// RPC 예외(영문 식별 문구)를 세입자 화면 문구로 바꾼다. 모르는 오류는 동작별 기본 문구.
function moveOutRpcError(
  error: MoveOutRpcError,
  fallback: string,
): Error & { code?: string } {
  const message = error.code === "23505" || error.message.includes("already exists")
    ? "이미 접수된 퇴실 신청이 있어요."
    : error.message.includes("pending move-out request not found")
      ? "퇴실 신청을 찾을 수 없어요. 화면을 새로고침해 주세요."
      : error.message.includes("linked occupancy not found")
        ? "연결된 세대 정보를 찾을 수 없어요."
        : error.code === "22023" || error.message.includes("desired date required")
          ? "희망 퇴실일을 선택해 주세요."
          : fallback;
  return Object.assign(new Error(message), { code: error.code });
}

const rowToMoveOut = (row: ResidentMoveOutRow): ResidentMoveOutRequest => ({
  id: row.id,
  desiredDate: row.desired_date,
  reason: row.reason,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  canceledAt: row.canceled_at,
  resolvedAt: row.resolved_at,
});

export async function residentCreateMoveOut(
  desiredDate: string,
  reason?: string | null,
): Promise<number> {
  const { data, error } = await createClient().rpc(
    "resident_create_move_out",
    {
      p_desired_date: desiredDate,
      p_reason: reason ?? null,
    },
  );
  if (error) throw moveOutRpcError(error, "퇴실 신청을 접수하지 못했어요.");
  if (typeof data !== "number") {
    throw new Error("퇴실 신청을 접수하지 못했어요.");
  }
  return data;
}

export async function residentGetMoveOut(): Promise<ResidentMoveOutResult> {
  const { data, error } = await createClient().rpc("resident_get_move_out");
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as ResidentMoveOutRow[])[0];
  return row ? rowToMoveOut(row) : null;
}

export async function residentUpdateMoveOut(
  desiredDate: string,
): Promise<void> {
  const { error } = await createClient().rpc("resident_update_move_out", {
    p_desired_date: desiredDate,
  });
  if (error) throw moveOutRpcError(error, "희망 퇴실일을 변경하지 못했어요.");
}

export async function residentCancelMoveOut(): Promise<void> {
  const { error } = await createClient().rpc("resident_cancel_move_out");
  if (error) throw moveOutRpcError(error, "퇴실 신청을 취소하지 못했어요.");
}
