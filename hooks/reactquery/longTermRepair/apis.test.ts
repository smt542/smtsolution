import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc }),
}));

import { getLedgerOpeningBalance, listLedgerByBuilding, monthDateRange, saveLedger } from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("longTermRepair ledger apis", () => {
  it("월 범위를 월초부터 월말까지 변환한다", () => {
    expect(monthDateRange("2026-01", "2026-02")).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-02-28",
    });
  });

  it("서버 누적잔액 원장을 조회하고 숫자 필드를 매핑한다", async () => {
    rpc.mockResolvedValue({
      data: [{
        id: 1,
        org_id: 9,
        building_id: 3,
        entry_date: "2026-05-01",
        entry_no: "001",
        fund_note: "정기 적립",
        deposit: "500000",
        withdrawal: "100000",
        running_balance: "400000",
        memo: null,
        created_at: "2026-05-01T00:00:00Z",
        updated_at: "2026-05-01T00:00:00Z",
      }],
      error: null,
    });

    const result = await listLedgerByBuilding(3, "2026-05", "2026-05");

    expect(rpc).toHaveBeenCalledWith("list_long_term_repair_ledger", {
      p_building_id: 3,
      p_start_date: "2026-05-01",
      p_end_date: "2026-05-31",
    });
    expect(result[0]).toMatchObject({
      buildingId: 3,
      entryNo: "001",
      fundNote: "정기 적립",
      deposit: 500000,
      withdrawal: 100000,
      balance: 400000,
    });
  });

  it("화면 원장 변경분을 저장 RPC 형식으로 변환한다", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await saveLedger({
      buildingId: 3,
      rows: [{
        id: 7,
        entryDate: "2026-06-01",
        entryNo: "002",
        fundNote: "옥상 공사",
        deposit: 0,
        withdrawal: 350000,
        memo: "완료",
      }],
      deletedIds: [5],
    });

    expect(rpc).toHaveBeenCalledWith("save_long_term_repair_ledger", {
      p_building_id: 3,
      p_rows: [{
        id: 7,
        entry_date: "2026-06-01",
        entry_no: "002",
        fund_note: "옥상 공사",
        deposit: 0,
        withdrawal: 350000,
        memo: "완료",
      }],
      p_deleted_ids: [5],
    });
  });

  it("조회 시작일 이전의 기초잔액을 숫자로 조회한다", async () => {
    rpc.mockResolvedValue({ data: "125000", error: null });

    await expect(getLedgerOpeningBalance(3, "2026-05")).resolves.toBe(125000);
    expect(rpc).toHaveBeenCalledWith("get_long_term_repair_ledger_opening_balance", {
      p_building_id: 3,
      p_start_date: "2026-05-01",
    });
  });
});
