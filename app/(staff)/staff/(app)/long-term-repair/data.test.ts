import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  buildingsOrder: vi.fn(),
  organizationMaybeSingle: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { getLongTermRepairPageData } from "./data";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ from: mocks.from });
  mocks.from.mockImplementation((table: string) => {
    if (table === "buildings") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({ order: mocks.buildingsOrder })),
          })),
        })),
      };
    }
    if (table === "organizations") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: mocks.organizationMaybeSingle })),
        })),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
});

describe("getLongTermRepairPageData", () => {
  it("원장에 필요한 최소 건물 필드와 조직명만 반환한다", async () => {
    mocks.buildingsOrder.mockResolvedValue({
      data: [{ id: 3, code: "B001", name: "한빛빌딩" }],
      error: null,
    });
    mocks.organizationMaybeSingle.mockResolvedValue({
      data: { name: "한빛관리" },
      error: null,
    });

    await expect(getLongTermRepairPageData(9)).resolves.toEqual({
      buildings: [{ id: 3, code: "B001", name: "한빛빌딩" }],
      organizationName: "한빛관리",
    });
    expect(mocks.from).toHaveBeenCalledWith("buildings");
    expect(mocks.from).toHaveBeenCalledWith("organizations");
  });

  it("건물 또는 조직 조회 오류를 전달한다", async () => {
    mocks.buildingsOrder.mockResolvedValue({ data: null, error: { message: "buildings failed" } });
    mocks.organizationMaybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(getLongTermRepairPageData(9)).rejects.toThrow("buildings failed");

    mocks.buildingsOrder.mockResolvedValue({ data: [], error: null });
    mocks.organizationMaybeSingle.mockResolvedValue({ data: null, error: { message: "organization failed" } });
    await expect(getLongTermRepairPageData(9)).rejects.toThrow("organization failed");
  });
});
