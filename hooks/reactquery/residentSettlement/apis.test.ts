import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

import {
  mintSettlementShareToken,
  publicSettlementByToken,
} from "./apis";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("settlement share-token APIs", () => {
  it("maps only the whitelisted public settlement fields", async () => {
    rpc.mockResolvedValue({
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

    await expect(
      publicSettlementByToken("66666666-7777-4888-8999-000000000000"),
    ).resolves.toEqual({
      moveOutDate: "2026-08-25",
      settlementKind: "추가납부",
      settlementAmount: 218806,
      unitLabel: "101동 201호",
      buildingName: "그린빌라",
      isExpired: false,
    });
    expect(rpc).toHaveBeenCalledWith("public_settlement_by_token", {
      p_token: "66666666-7777-4888-8999-000000000000",
    });
  });

  it("returns null for an unknown token", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(publicSettlementByToken("missing")).resolves.toBeNull();
  });

  it("mints a staff settlement token and forwards RPC errors", async () => {
    rpc
      .mockResolvedValueOnce({
        data: "66666666-7777-4888-8999-000000000000",
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: "forbidden" } });

    await expect(mintSettlementShareToken(73)).resolves.toBe(
      "66666666-7777-4888-8999-000000000000",
    );
    expect(rpc).toHaveBeenCalledWith("mint_settlement_share_token", {
      p_settlement_id: 73,
    });
    await expect(mintSettlementShareToken(74)).rejects.toThrow("forbidden");
  });
});
