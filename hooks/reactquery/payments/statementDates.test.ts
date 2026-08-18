import { beforeEach, describe, expect, it, vi } from "vitest";

const order = vi.fn();
const lte = vi.fn(() => ({ order }));
const gte = vi.fn(() => ({ lte }));
const statusEq = vi.fn(() => ({ gte }));
const buildingEq = vi.fn(() => ({ eq: statusEq }));
const select = vi.fn(() => ({ eq: buildingEq }));
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));

import { listBuildingPaymentDates } from "./apis";

beforeEach(() => {
  vi.clearAllMocks();
  order.mockResolvedValue({
    data: [{ unit_id: 11, period: "2026-08-01", paid_at: "2026-08-15" }],
    error: null,
  });
});

describe("listBuildingPaymentDates", () => {
  it("건물·기간의 active 수납일을 한 번에 조회해 매핑한다", async () => {
    await expect(
      listBuildingPaymentDates(3, "2026-07-01", "2026-08-01"),
    ).resolves.toEqual([
      { unitId: 11, period: "2026-08-01", paidAt: "2026-08-15" },
    ]);

    expect(from).toHaveBeenCalledWith("payments");
    expect(buildingEq).toHaveBeenCalledWith("units.building_id", 3);
    expect(statusEq).toHaveBeenCalledWith("status", "active");
    expect(gte).toHaveBeenCalledWith("period", "2026-07-01");
    expect(lte).toHaveBeenCalledWith("period", "2026-08-01");
  });
});
