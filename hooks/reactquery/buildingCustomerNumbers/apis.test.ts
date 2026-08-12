// hooks/reactquery/buildingCustomerNumbers/apis.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listCustomerNumbersByBuilding } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("buildingCustomerNumbers apis", () => {
  it("listByBuilding: building_id + deleted_at null + sort_order + snake→camel", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 1, building_id: 3, kind: "water", customer_no: "C-1", meter_day: 5,
        billing_basis: "current", print_on_bill: true, holder_name: "홍길동", sort_order: 0 }],
      error: null,
    });
    const is = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ is }));
    from.mockReturnValue({ select: () => ({ eq }) });

    const r = await listCustomerNumbersByBuilding(3);

    expect(from).toHaveBeenCalledWith("building_customer_numbers");
    expect(eq).toHaveBeenCalledWith("building_id", 3);
    expect(is).toHaveBeenCalledWith("deleted_at", null);
    expect(r[0]).toEqual({ id: 1, buildingId: 3, kind: "water", customerNo: "C-1", meterDay: 5,
      billingBasis: "current", printOnBill: true, holderName: "홍길동", sortOrder: 0 });
  });
});
