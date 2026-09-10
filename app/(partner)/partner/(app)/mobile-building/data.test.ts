import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { getPartnerBuildingPageData } from "./data";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

describe("partner mobile building server data", () => {
  it("loads building, units, and vendors in parallel", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "partner_get_building") {
        return Promise.resolve({ data: [{ id: 7, name: "해오름빌라" }] });
      }
      if (name === "partner_list_units") {
        return Promise.resolve({ data: [{ unit_id: 11, unit_no: "201호" }] });
      }
      return Promise.resolve({ data: [{ id: 21, name: "승강기 업체" }] });
    });

    await expect(getPartnerBuildingPageData(7)).resolves.toEqual({
      building: { id: 7, name: "해오름빌라" },
      units: [{ unit_id: 11, unit_no: "201호" }],
      vendors: [{ id: 21, name: "승강기 업체" }],
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "partner_get_building", {
      p_building_id: 7,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "partner_list_units", {
      p_building_id: 7,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      3,
      "partner_list_building_vendors",
      { p_building_id: 7 },
    );
  });

  it("normalizes non-array RPC payloads to empty collections", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null });

    await expect(getPartnerBuildingPageData(9)).resolves.toEqual({
      building: null,
      units: [],
      vendors: [],
    });
  });
});
