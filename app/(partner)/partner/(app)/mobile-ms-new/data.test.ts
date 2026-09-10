import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { getPartnerSettlementContextData } from "./data";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

describe("partner settlement server data", () => {
  it("uses the unchanged context RPC payload", async () => {
    const context = { unit: { id: 7 } };
    mocks.rpc.mockResolvedValue({ data: context, error: null });

    await expect(
      getPartnerSettlementContextData(7, 19),
    ).resolves.toBe(context);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "partner_get_settlement_context",
      {
        p_unit_id: 7,
        p_settlement_id: 19,
      },
    );
  });

  it("sends null for create mode and forwards RPC errors", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: {}, error: null });
    await getPartnerSettlementContextData(7, null);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "partner_get_settlement_context",
      {
        p_unit_id: 7,
        p_settlement_id: null,
      },
    );

    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "context failed" },
    });
    await expect(getPartnerSettlementContextData(7)).rejects.toThrow(
      "context failed",
    );
  });
});
