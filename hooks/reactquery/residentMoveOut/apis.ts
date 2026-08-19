import { createClient } from "@/lib/supabase/client";

export type ResidentMoveOutStatus =
  | "pending"
  | "confirmed"
  | "canceled"
  | "rejected";

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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
}

export async function residentCancelMoveOut(): Promise<void> {
  const { error } = await createClient().rpc("resident_cancel_move_out");
  if (error) throw new Error(error.message);
}
