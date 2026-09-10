import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { getPublicSettlementByToken } from "./data";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

describe("getPublicSettlementByToken", () => {
  it("maps only the whitelisted public settlement fields", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        move_out_date: "2026-08-25",
        settlement_kind: "추가납부",
        settlement_amount: 218806,
        unit_label: "101동 201호",
        building_name: "그린빌라",
        is_expired: false,
        tenant_name: "노출되면 안 됨",
        phone: "010-0000-0000",
      },
      error: null,
    });

    await expect(getPublicSettlementByToken("settlement-token")).resolves.toEqual({
      moveOutDate: "2026-08-25",
      settlementKind: "추가납부",
      settlementAmount: 218806,
      unitLabel: "101동 201호",
      buildingName: "그린빌라",
      isExpired: false,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("public_settlement_by_token", {
      p_token: "settlement-token",
    });
  });

  it("returns null for an unknown token and forwards RPC errors", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "failed" } });

    await expect(getPublicSettlementByToken("missing")).resolves.toBeNull();
    await expect(getPublicSettlementByToken("failed")).rejects.toThrow("failed");
  });
});
