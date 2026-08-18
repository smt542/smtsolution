import { createClient } from "@/lib/supabase/client";

export interface LongTermRepairLedgerEntry {
  id: number;
  orgId: number;
  buildingId: number;
  entryDate: string;
  entryNo: string;
  fundNote: string;
  deposit: number;
  withdrawal: number;
  balance: number;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LongTermRepairLedgerInput {
  id?: number;
  entryDate: string;
  entryNo: string;
  fundNote: string;
  deposit: number;
  withdrawal: number;
  memo?: string | null;
}

export interface SaveLongTermRepairLedgerInput {
  buildingId: number;
  rows: LongTermRepairLedgerInput[];
  deletedIds: number[];
}

type LongTermRepairLedgerRow = {
  id: number;
  org_id: number;
  building_id: number;
  entry_date: string;
  entry_no: string;
  fund_note: string;
  deposit: number | string;
  withdrawal: number | string;
  running_balance: number | string;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

const toLedgerEntry = (row: LongTermRepairLedgerRow): LongTermRepairLedgerEntry => ({
  id: row.id,
  orgId: row.org_id,
  buildingId: row.building_id,
  entryDate: row.entry_date,
  entryNo: row.entry_no,
  fundNote: row.fund_note,
  deposit: Number(row.deposit),
  withdrawal: Number(row.withdrawal),
  balance: Number(row.running_balance),
  memo: row.memo,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function monthDateRange(startMonth: string, endMonth: string) {
  const [endYear, endMonthNumber] = endMonth.split("-").map(Number);
  const endDate = new Date(Date.UTC(endYear, endMonthNumber, 0));
  return {
    startDate: `${startMonth}-01`,
    endDate: endDate.toISOString().slice(0, 10),
  };
}

export async function listLedgerByBuilding(
  buildingId: number,
  startMonth: string,
  endMonth: string,
): Promise<LongTermRepairLedgerEntry[]> {
  const { startDate, endDate } = monthDateRange(startMonth, endMonth);
  const { data, error } = await createClient().rpc("list_long_term_repair_ledger", {
    p_building_id: buildingId,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as LongTermRepairLedgerRow[]).map(toLedgerEntry);
}

export async function getLedgerOpeningBalance(
  buildingId: number,
  startMonth: string,
): Promise<number> {
  const { data, error } = await createClient().rpc("get_long_term_repair_ledger_opening_balance", {
    p_building_id: buildingId,
    p_start_date: `${startMonth}-01`,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function saveLedger(input: SaveLongTermRepairLedgerInput): Promise<void> {
  const { error } = await createClient().rpc("save_long_term_repair_ledger", {
    p_building_id: input.buildingId,
    p_rows: input.rows.map((row) => ({
      id: row.id ?? null,
      entry_date: row.entryDate,
      entry_no: row.entryNo,
      fund_note: row.fundNote,
      deposit: row.deposit,
      withdrawal: row.withdrawal,
      memo: row.memo ?? null,
    })),
    p_deleted_ids: input.deletedIds,
  });
  if (error) throw new Error(error.message);
}
