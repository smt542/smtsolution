import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from, rpc }) }));

import { listCustomerNumbers, listCustomerNumbersByBuilding } from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("buildingCustomerNumbers apis", () => {
  it("건물별 고객번호의 신규 필드를 camelCase로 변환한다", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{
        id: 1,
        building_id: 3,
        kind: "water",
        customer_no: "C-1",
        line_name: "A",
        meter_day: 5,
        billing_basis: "current",
        calculation_method: "manual",
        note: "확인",
        print_on_bill: true,
        holder_name: "홍길동",
        sort_order: 0,
      }],
      error: null,
    });
    const is = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ is }));
    from.mockReturnValue({ select: () => ({ eq }) });

    const result = await listCustomerNumbersByBuilding(3);

    expect(eq).toHaveBeenCalledWith("building_id", 3);
    expect(result[0]).toEqual({
      id: 1,
      buildingId: 3,
      kind: "water",
      customerNo: "C-1",
      lineName: "A",
      meterDay: 5,
      billingBasis: "current",
      calculationMethod: "manual",
      note: "확인",
      printOnBill: true,
      holderName: "홍길동",
      sortOrder: 0,
    });
  });

  it("조직 범위 RPC에 유형, 정리한 검색어, 페이지를 전달한다", async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await listCustomerNumbers({ kind: "common_elec", q: "  강남  ", page: 2, pageSize: 25 });

    expect(rpc).toHaveBeenCalledWith("list_customer_number_lookup", {
      p_kind: "common_elec",
      p_query: "강남",
      p_limit: 25,
      p_offset: 25,
    });
  });

  it("RPC 행과 total_count를 조회 뷰 모델로 변환한다", async () => {
    rpc.mockResolvedValue({
      data: [{
        id: 11,
        building_id: 7,
        building_code: "B0007",
        building_name: "해오름빌라",
        address: "서울시",
        kind: "water",
        customer_no: "W-200",
        line_name: "1",
        meter_day: null,
        billing_basis: "prev",
        calculation_method: "auto",
        note: null,
        sort_order: 0,
        total_count: 3,
      }],
      error: null,
    });

    const result = await listCustomerNumbers({ kind: "water" });

    expect(result).toEqual({
      rows: [{
        id: 11,
        buildingId: 7,
        buildingCode: "B0007",
        buildingName: "해오름빌라",
        address: "서울시",
        kind: "water",
        customerNo: "W-200",
        lineName: "1",
        meterDay: null,
        billingBasis: "prev",
        calculationMethod: "auto",
        note: null,
      }],
      total: 3,
    });
  });
});
