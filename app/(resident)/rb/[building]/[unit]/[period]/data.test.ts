import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { getPublicBillBySigned } from "./data";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

describe("getPublicBillBySigned", () => {
  it("maps only the whitelisted public bill fields", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          period: "2026-08-01",
          building_name: "그린빌라",
          unit_no: "201호",
          total_amount: 120000,
          paid_amount: 0,
          unpaid_amount: 120000,
          late_fee: 0,
          due_date: "2026-08-25",
          items: [
            {
              name: "수도료",
              amount: 20000,
              utility: "water",
              usage: 8.2,
              prev_usage: 7.6,
            },
          ],
          mgmt_bank: "관리은행",
          mgmt_acct: "123-456",
          mgmt_holder: "그린관리",
          expires_at: "2027-08-31T23:59:59Z",
          is_expired: false,
          tenant_name: "노출되면 안 됨",
        },
      ],
      error: null,
    });

    await expect(
      getPublicBillBySigned(7, "201호", "2026-08", "signed-value"),
    ).resolves.toEqual({
      period: "2026-08-01",
      buildingName: "그린빌라",
      unitNo: "201호",
      totalAmount: 120000,
      paidAmount: 0,
      unpaidAmount: 120000,
      lateFee: 0,
      dueDate: "2026-08-25",
      items: [
        {
          name: "수도료",
          amount: 20000,
          utility: "water",
          usage: 8.2,
          prevUsage: 7.6,
        },
      ],
      mgmtBank: "관리은행",
      mgmtAcct: "123-456",
      mgmtHolder: "그린관리",
      expiresAt: "2027-08-31T23:59:59Z",
      isExpired: false,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("public_bill_by_signed", {
      p_building_id: 7,
      p_unit_no: "201호",
      p_period: "2026-08-01",
      p_sig: "signed-value",
    });
  });

  it("returns null for an invalid signature and forwards RPC errors", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "failed" } });

    await expect(
      getPublicBillBySigned(7, "201호", "2026-08", "invalid"),
    ).resolves.toBeNull();
    await expect(
      getPublicBillBySigned(7, "201호", "2026-08", "failed"),
    ).rejects.toThrow("failed");
  });
});
