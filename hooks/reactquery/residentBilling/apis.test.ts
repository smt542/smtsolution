import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

import { residentBillDetail, residentBillMonths } from "./apis";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resident billing APIs", () => {
  it("maps resident_bill_months rows to camelCase", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          period: "2026-08-01",
          total_amount: 120000,
          paid_amount: 20000,
          unpaid_amount: 100000,
          pay_status: "partial",
          due_date: "2026-08-25",
          confirmed_at: "2026-08-10T00:00:00Z",
        },
      ],
      error: null,
    });

    await expect(residentBillMonths()).resolves.toEqual([
      {
        period: "2026-08-01",
        totalAmount: 120000,
        paidAmount: 20000,
        unpaidAmount: 100000,
        payStatus: "partial",
        dueDate: "2026-08-25",
        confirmedAt: "2026-08-10T00:00:00Z",
      },
    ]);
    expect(rpc).toHaveBeenCalledWith("resident_bill_months");
  });

  it("passes p_period and maps resident_bill_detail including item fields", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          period: "2026-08-01",
          building_name: "그린빌라",
          unit_no: "201호",
          tenant_name: "김주민",
          total_amount: 120000,
          paid_amount: 0,
          unpaid_amount: 120000,
          late_fee: 0,
          due_date: "2026-08-25",
          confirmed_at: "2026-08-10T00:00:00Z",
          items: [
            {
              fee_item_id: 5,
              name: "수도료",
              amount: 20000,
              charged: true,
              utility: "water",
              usage: 8.2,
              prev_usage: 7.6,
            },
            {
              fee_item_id: 3,
              name: "일반관리비",
              amount: 100000,
              charged: true,
              utility: null,
              usage: null,
              prev_usage: null,
            },
          ],
          mgmt_bank: "관리은행",
          mgmt_acct: "123-456",
          mgmt_holder: "그린관리",
        },
      ],
      error: null,
    });

    await expect(residentBillDetail("2026-08-01")).resolves.toMatchObject({
      buildingName: "그린빌라",
      unitNo: "201호",
      tenantName: "김주민",
      totalAmount: 120000,
      lateFee: 0,
      items: [
        {
          feeItemId: 5,
          name: "수도료",
          amount: 20000,
          charged: true,
          utility: "water",
          usage: 8.2,
          prevUsage: 7.6,
        },
        {
          feeItemId: 3,
          name: "일반관리비",
          amount: 100000,
          charged: true,
          utility: null,
          usage: null,
          prevUsage: null,
        },
      ],
      mgmtBank: "관리은행",
      mgmtAcct: "123-456",
      mgmtHolder: "그린관리",
    });
    expect(rpc).toHaveBeenCalledWith("resident_bill_detail", {
      p_period: "2026-08-01",
    });
  });

  it("returns null for zero-row detail RPCs and throws RPC errors", async () => {
    rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "billing failed" } });

    await expect(residentBillDetail("2026-07-01")).resolves.toBeNull();
    await expect(residentBillMonths()).rejects.toThrow("billing failed");
  });
});
