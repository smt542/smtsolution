import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { getResidentBillDetail, getResidentBillPageData } from "./data";

const linkRow = {
  claim_id: 1,
  org_id: 2,
  building_id: 3,
  building_name: "그린빌라",
  unit_id: 4,
  unit_no: "201호",
  occupancy_id: 5,
  tenant_name: "김주민",
  occupancy_phone: "010-0000-0000",
  linked_at: "2026-01-01T00:00:00Z",
};

const monthRow = {
  period: "2026-08-01",
  total_amount: 120000,
  paid_amount: 20000,
  unpaid_amount: 100000,
  late_fee: 6800,
  paid_date: null,
  pay_status: "partial",
  due_date: "2026-08-25",
  confirmed_at: "2026-08-10T00:00:00Z",
};

const detailRow = {
  period: "2026-08-01",
  building_name: "그린빌라",
  unit_no: "201호",
  tenant_name: "김주민",
  total_amount: 120000,
  paid_amount: 20000,
  unpaid_amount: 100000,
  late_fee: 6800,
  due_date: "2026-08-25",
  confirmed_at: "2026-08-10T00:00:00Z",
  items: [
    {
      fee_item_id: 11,
      name: "수도료",
      amount: 12000,
      charged: true,
      utility: "water",
      usage: 8.2,
      prev_usage: 7.6,
    },
  ],
  mgmt_bank: "관리은행",
  mgmt_acct: "123-456",
  mgmt_holder: "그린관리",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

describe("resident bill server data", () => {
  it("loads and maps the linked household and bill months in parallel", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "resident_my_link") {
        return Promise.resolve({ data: [linkRow], error: null });
      }
      return Promise.resolve({ data: [monthRow], error: null });
    });

    await expect(getResidentBillPageData()).resolves.toEqual({
      link: {
        claimId: 1,
        orgId: 2,
        buildingId: 3,
        buildingName: "그린빌라",
        unitId: 4,
        unitNo: "201호",
        occupancyId: 5,
        tenantName: "김주민",
        occupancyPhone: "010-0000-0000",
        linkedAt: "2026-01-01T00:00:00Z",
      },
      months: [
        {
          period: "2026-08-01",
          totalAmount: 120000,
          paidAmount: 20000,
          unpaidAmount: 100000,
          lateFee: 6800,
          paidDate: null,
          payStatus: "partial",
          dueDate: "2026-08-25",
          confirmedAt: "2026-08-10T00:00:00Z",
        },
      ],
    });
    expect(mocks.rpc).toHaveBeenCalledWith("resident_my_link");
    expect(mocks.rpc).toHaveBeenCalledWith("resident_bill_months");
  });

  it("maps a bill detail and returns null for zero rows", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [detailRow], error: null });

    await expect(getResidentBillDetail("2026-08-01")).resolves.toMatchObject({
      period: "2026-08-01",
      lateFee: 6800,
      items: [
        {
          feeItemId: 11,
          utility: "water",
          usage: 8.2,
          prevUsage: 7.6,
        },
      ],
    });
    expect(mocks.rpc).toHaveBeenCalledWith("resident_bill_detail", {
      p_period: "2026-08-01",
    });

    mocks.rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(getResidentBillDetail("2026-07-01")).resolves.toBeNull();
  });

  it("forwards list and detail RPC errors", async () => {
    mocks.rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === "resident_my_link"
          ? { data: null, error: { message: "link failed" } }
          : { data: [], error: null },
      ),
    );
    await expect(getResidentBillPageData()).rejects.toThrow("link failed");

    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "detail failed" },
    });
    await expect(getResidentBillDetail("2026-08-01")).rejects.toThrow(
      "detail failed",
    );
  });
});
