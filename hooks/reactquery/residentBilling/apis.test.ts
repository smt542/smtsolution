import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

import {
  publicBillByToken,
  residentBillDetail,
  residentBillMonths,
  residentGetOrCreateBillToken,
  staffMintBillTokens,
  staffRevokeBillToken,
} from "./apis";

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

  it("returns the scalar UUID from resident_get_or_create_bill_token", async () => {
    rpc.mockResolvedValue({ data: "11111111-2222-4333-8444-555555555555", error: null });

    await expect(
      residentGetOrCreateBillToken("2026-08-01"),
    ).resolves.toBe("11111111-2222-4333-8444-555555555555");
    expect(rpc).toHaveBeenCalledWith(
      "resident_get_or_create_bill_token",
      { p_period: "2026-08-01" },
    );
  });

  it("mints staff bill tokens in bulk and maps the RPC rows", async () => {
    rpc.mockResolvedValue({
      data: [
        { unit_id: 11, token: "11111111-2222-4333-8444-555555555555" },
        { unit_id: 12, token: "66666666-7777-4888-8999-000000000000" },
      ],
      error: null,
    });

    await expect(
      staffMintBillTokens({
        unitIds: [11, 12],
        period: "2026-08-01",
      }),
    ).resolves.toEqual([
      { unitId: 11, token: "11111111-2222-4333-8444-555555555555" },
      { unitId: 12, token: "66666666-7777-4888-8999-000000000000" },
    ]);
    expect(rpc).toHaveBeenCalledWith("staff_mint_bill_tokens", {
      p_unit_ids: [11, 12],
      p_period: "2026-08-01",
    });
  });

  it("passes p_token and maps public rows without resident PII", async () => {
    rpc.mockResolvedValue({
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
              amount: 120000,
              utility: "water",
              usage: 8.2,
              prev_usage: 7.6,
            },
          ],
          mgmt_bank: "관리은행",
          mgmt_acct: "123-456",
          mgmt_holder: "그린관리",
          expires_at: "2027-08-19T00:00:00Z",
          is_expired: false,
        },
      ],
      error: null,
    });

    const detail = await publicBillByToken(
      "11111111-2222-4333-8444-555555555555",
    );

    expect(detail).toEqual({
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
          amount: 120000,
          utility: "water",
          usage: 8.2,
          prevUsage: 7.6,
        },
      ],
      mgmtBank: "관리은행",
      mgmtAcct: "123-456",
      mgmtHolder: "그린관리",
      expiresAt: "2027-08-19T00:00:00Z",
      isExpired: false,
    });
    expect(detail).not.toHaveProperty("tenantName");
    expect(detail).not.toHaveProperty("phone");
    expect(rpc).toHaveBeenCalledWith("public_bill_by_token", {
      p_token: "11111111-2222-4333-8444-555555555555",
    });
  });

  it("revokes a staff bill token via RPC and returns the boolean result", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(
      staffRevokeBillToken("11111111-2222-4333-8444-555555555555"),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("staff_revoke_bill_token", {
      p_token: "11111111-2222-4333-8444-555555555555",
    });
  });

  it("returns false when staff_revoke_bill_token finds no matching token", async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    await expect(
      staffRevokeBillToken("00000000-0000-4000-8000-000000000000"),
    ).resolves.toBe(false);
  });

  it("returns null for zero-row detail RPCs and throws RPC errors", async () => {
    rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "billing failed" } });

    await expect(residentBillDetail("2026-07-01")).resolves.toBeNull();
    await expect(residentBillMonths()).rejects.toThrow("billing failed");
  });
});
