import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getReceiptStatementData,
  listReceiptPaymentStatus,
  mapReceiptWorkspaceRows,
} from "./queries";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc }),
}));

beforeEach(() => {
  rpc.mockReset();
});

describe("mapReceiptWorkspaceRows", () => {
  it("조직 RPC 행을 수납 현황과 건물별 항목 합계로 변환한다", () => {
    const result = mapReceiptWorkspaceRows([
      {
        building_id: 2,
        building_name: "그린빌라",
        unit_id: 21,
        unit_no: "101호",
        dong: "A동",
        occupancy_id: 31,
        tenant_name: "김입주",
        is_vacant: false,
        is_auto_debit: false,
        due_date: "2026-08-25",
        payer_no: null,
        payer_name: null,
        charged: 120_000,
        paid: 50_000,
        unpaid: 70_000,
        pay_status: "partial",
        phone: "010-1111-2222",
        overdue_months: 1,
        overdue_amount: 70_000,
        last_payment_date: "2026-08-10",
        fee_item_totals: [
          { fee_item_id: 1, fee_item_name: "일반관리비", amount: 120_000 },
        ],
      },
    ]);

    expect(result.rows[0]).toEqual(expect.objectContaining({
      buildingId: 2,
      buildingName: "그린빌라",
      dueDate: "2026-08-25",
      phone: "010-1111-2222",
      overdueMonths: 1,
      overdueAmount: 70_000,
    }));
    expect(result.feeItems).toEqual([
      expect.objectContaining({ feeItemName: "일반관리비", amount: 120_000 }),
    ]);
  });
});

describe("receipts RPC queries", () => {
  it("조직·월분 워크스페이스를 RPC 한 번으로 조회한다", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });

    await expect(listReceiptPaymentStatus(7, "2026-08-01")).resolves.toEqual({
      rows: [],
      feeItems: [],
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("list_receipts_workspace", {
      p_org_id: 7,
      p_period: "2026-08-01",
    });
  });

  it("기간 명세서의 수납·문서·공과금 데이터를 RPC 한 번으로 조회한다", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        payment_rows: [],
        payments: [],
        documents: [],
        utilities: { electricity: [], water: [], gas: [] },
      },
      error: null,
    });

    const result = await getReceiptStatementData(
      2,
      21,
      "2026-01-01",
      "2026-12-01",
    );

    expect(result).toEqual({
      paymentRows: [],
      payments: [],
      documents: [],
      utilities: { electricity: [], water: [], gas: [] },
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_payment_statement_data", {
      p_building_id: 2,
      p_unit_id: 21,
      p_start_period: "2026-01-01",
      p_end_period: "2026-12-01",
    });
  });
});
