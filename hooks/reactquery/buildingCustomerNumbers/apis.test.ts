// hooks/reactquery/buildingCustomerNumbers/apis.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listCustomerNumbers, listCustomerNumbersByBuilding } from "./apis";
beforeEach(() => vi.clearAllMocks());

function mockLookupQuery(data: unknown[] = []) {
  const query: {
    is: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
  } = {
    is: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
  };
  query.is.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.order.mockReturnValueOnce(query).mockResolvedValueOnce({ data, error: null });
  const select = vi.fn(() => query);
  from.mockReturnValue({ select });
  return { query, select };
}

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


  it("listCustomerNumbers: no filters applies deleted_at and ordering", async () => {
    const { query, select } = mockLookupQuery();

    await listCustomerNumbers({});

    expect(from).toHaveBeenCalledWith("building_customer_numbers");
    expect(select).toHaveBeenCalledWith(
      "id, kind, customer_no, meter_day, billing_basis, print_on_bill, holder_name, building_id, buildings!inner(id, name)",
    );
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
    expect(query.eq).not.toHaveBeenCalled();
    expect(query.or).not.toHaveBeenCalled();
    expect(query.order.mock.calls).toEqual([["building_id"], ["sort_order"]]);
  });

  it("listCustomerNumbers: applies building and kind filters", async () => {
    const { query } = mockLookupQuery();

    await listCustomerNumbers({ buildingId: 7, kind: "gas" });

    expect(query.eq.mock.calls).toEqual([
      ["building_id", 7],
      ["kind", "gas"],
    ]);
  });

  it("listCustomerNumbers: trims q and applies the customer/holder ilike or filter", async () => {
    const { query } = mockLookupQuery();

    await listCustomerNumbers({ q: "  C-10  " });

    expect(query.or).toHaveBeenCalledWith(
      "customer_no.ilike.%C-10%,holder_name.ilike.%C-10%",
    );
  });

  it("listCustomerNumbers: maps joined database rows to the lookup view model", async () => {
    mockLookupQuery([
      {
        id: 11,
        building_id: 7,
        buildings: { id: 7, name: "해오름빌딩" },
        kind: "common_elec",
        customer_no: "E-200",
        meter_day: null,
        billing_basis: "prev",
        print_on_bill: false,
        holder_name: null,
      },
    ]);

    const result = await listCustomerNumbers({});

    expect(result).toEqual([
      {
        id: 11,
        buildingId: 7,
        buildingName: "해오름빌딩",
        kind: "common_elec",
        customerNo: "E-200",
        meterDay: null,
        billingBasis: "prev",
        printOnBill: false,
        holderName: null,
      },
    ]);
  });
});
