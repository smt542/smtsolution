import { beforeEach, describe, expect, it, vi } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { getOrgBuildings } from "./drilldown";
import { getBuildingTenants, getUnitOccupancy } from "./drilldown";
beforeEach(() => vi.clearAllMocks());

describe("getOrgBuildings", () => {
  it("조직 + 건물 목록을 camelCase로 반환한다", async () => {
    from.mockImplementation((table: string) => {
      if (table === "organizations") {
        return { select: () => ({ eq: () => ({ single: () =>
          Promise.resolve({ data: { id: 3, name: "가나관리", slug: "gana", status: "active" }, error: null }) }) }) };
      }
      // buildings
      return { select: () => ({ eq: () => ({ is: () => ({ order: () =>
        Promise.resolve({ data: [{ id: 7, code: "B0007", name: "가나빌", address: "서울" }], error: null }) }) }) }) };
    });
    const r = await getOrgBuildings(3);
    expect(r.org).toMatchObject({ id: 3, name: "가나관리", status: "active" });
    expect(r.buildings).toEqual([{ id: 7, code: "B0007", name: "가나빌", address: "서울" }]);
  });

  it("건물 조회 에러는 throw", async () => {
    from.mockImplementation((table: string) => {
      if (table === "organizations") return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 3 }, error: null }) }) }) };
      return { select: () => ({ eq: () => ({ is: () => ({ order: () => Promise.resolve({ data: null, error: { message: "forbidden" } }) }) }) }) };
    });
    await expect(getOrgBuildings(3)).rejects.toThrow("forbidden");
  });
});

describe("getBuildingTenants", () => {
  it("건물·조직 + 세대별 최신 입주를 결합한다(입주 없으면 공실)", async () => {
    from.mockImplementation((table: string) => {
      if (table === "buildings") return { select: () => ({ eq: () => ({ single: () =>
        Promise.resolve({ data: { id: 7, name: "가나빌", org_id: 3 }, error: null }) }) }) };
      if (table === "organizations") return { select: () => ({ eq: () => ({ single: () =>
        Promise.resolve({ data: { id: 3, name: "가나관리" }, error: null }) }) }) };
      if (table === "units") return { select: () => ({ eq: () => ({ is: () => ({ order: () =>
        Promise.resolve({ data: [{ id: 11, unit_no: "101" }, { id: 12, unit_no: "102" }], error: null }) }) }) }) };
      // occupancies
      return { select: () => ({ in: () => ({ is: () => ({ order: () =>
        Promise.resolve({ data: [
          { id: 22, unit_id: 11, tenant_name: "홍길동", resident_count: 2, move_in_date: "2026-01-01", status: "occupied" },
        ], error: null }) }) }) }) };
    });
    const r = await getBuildingTenants(7);
    expect(r.org).toMatchObject({ id: 3, name: "가나관리" });
    expect(r.building).toMatchObject({ id: 7, name: "가나빌" });
    expect(r.tenants).toHaveLength(2);
    expect(r.tenants[0]).toMatchObject({ unitId: 11, occupancyId: 22, residentCount: 2, isVacant: false });
    expect(r.tenants[1]).toMatchObject({ unitId: 12, occupancyId: null, isVacant: true });
    // 통합관리자는 입주자 개인정보(성명 등)를 받지 않는다
    expect(r.tenants[0]).not.toHaveProperty("tenantName");
  });
});

describe("getUnitOccupancy", () => {
  it("세대+최신입주+룸타입+상위컨텍스트를 반환한다", async () => {
    from.mockImplementation((table: string) => {
      if (table === "units") return { select: () => ({ eq: () => ({ single: () =>
        Promise.resolve({ data: { id: 11, unit_no: "101", dong: "가", area_pyeong: 24, room_count: 2, building_id: 7 }, error: null }) }) }) };
      if (table === "buildings") return { select: () => ({ eq: () => ({ single: () =>
        Promise.resolve({ data: { id: 7, name: "가나빌", org_id: 3 }, error: null }) }) }) };
      if (table === "occupancies") return { select: () => ({ eq: () => ({ is: () => ({ order: () => ({ limit: () =>
        Promise.resolve({ data: [{ id: 22, tenant_name: "홍길동", payer_name: "홍길동", phone: "010", phone2: null, phone3: null, vehicle_no: null, resident_count: 2, room_type_id: 5, move_in_date: "2026-01-01", move_out_date: null, status: "occupied", billing_note: null, facility_note: null }], error: null }) }) }) }) }) };
      if (table === "organizations") return { select: () => ({ eq: () => ({ single: () =>
        Promise.resolve({ data: { name: "가나관리" }, error: null }) }) }) };
      // room_types
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { label: "원룸" }, error: null }) }) }) };
    });
    const r = await getUnitOccupancy(11);
    expect(r).toMatchObject({ unitId: 11, unitNo: "101", buildingName: "가나빌", orgName: "가나관리" });
    expect(r.occupancy).toMatchObject({ occupancyId: 22, roomTypeLabel: "원룸", status: "occupied" });
    // 통합관리자는 개인정보(성명·연락처·차량 등)를 받지 않는다
    expect(r.occupancy).not.toHaveProperty("tenantName");
    expect(r.occupancy).not.toHaveProperty("phone");
  });

  it("입주 없으면 occupancy=null(룸타입 조회 안 함)", async () => {
    from.mockImplementation((table: string) => {
      if (table === "units") return { select: () => ({ eq: () => ({ single: () =>
        Promise.resolve({ data: { id: 12, unit_no: "102", dong: null, area_pyeong: null, room_count: null, building_id: 7 }, error: null }) }) }) };
      if (table === "buildings") return { select: () => ({ eq: () => ({ single: () =>
        Promise.resolve({ data: { id: 7, name: "가나빌", org_id: 3 }, error: null }) }) }) };
      if (table === "occupancies") return { select: () => ({ eq: () => ({ is: () => ({ order: () => ({ limit: () =>
        Promise.resolve({ data: [], error: null }) }) }) }) }) };
      // organizations
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { name: "가나관리" }, error: null }) }) }) };
    });
    const r = await getUnitOccupancy(12);
    expect(r.occupancy).toBeNull();
  });
});
