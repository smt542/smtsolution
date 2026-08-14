import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc, from }) }));

const invalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
  useMutation: (options: unknown) => options,
  useQuery: (options: unknown) => options,
}));

import {
  clearFixedUsage,
  confirmUtilities,
  dbUtility,
  deleteWaterDiscount,
  getUtilityConfirmation,
  ledgerDownloadUrl,
  listFixedUsages,
  listMeterHistory,
  listScopedPrices,
  listUtilityPrices,
  listUtilityRows,
  saveScopedPrices,
  saveMeterReadings,
  saveUtilityUnitPrices,
  saveWaterDiscount,
  setFixedUsage,
} from "./apis";
import { utilityKeys } from "./keys";
import {
  useClearFixedUsage,
  useConfirmUtilities,
  useSaveScopedPrices,
  useSaveUtilityUnitPrices,
  useSetFixedUsage,
} from "./mutations";
import { useFixedUsages, useScopedPrices } from "./queries";

beforeEach(() => vi.clearAllMocks());

describe("utilities apis", () => {
  it("dbUtility: electricity→elec, 나머지 그대로", () => {
    expect(dbUtility("electricity")).toBe("elec");
    expect(dbUtility("water")).toBe("water");
    expect(dbUtility("gas")).toBe("gas");
  });

  it("listUtilityRows: list_utility_rows RPC(elec 매핑) + snake→camel", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 101, unit_no: "101호", dong: "A동", occupancy_id: 9, tenant_name: "홍길동",
      occupancy_status: "occupied", move_in_date: "2026-08-01", customer_no: "E-101", meter_no: "M-101",
      previous_reading: 100, current_reading: 158, usage: 58, unit_price: null, calc_charge: null,
      discount_amount: null, manual_charge: null, note: null, processed_at: null, discount_type: null,
      resolved_unit_price: 125.5,
    }], error: null });

    const rows = await listUtilityRows(3, "electricity", "2026-08-01");

    expect(rpc).toHaveBeenCalledWith("list_utility_rows", { p_building_id: 3, p_utility: "elec", p_period: "2026-08-01" });
    expect(rows[0]).toMatchObject({
      unitId: 101, unitNo: "101호", dong: "A동", occupancyId: 9, tenantName: "홍길동",
      occupancyStatus: "occupied", customerNumber: "E-101", meterNumber: "M-101",
      previousReading: 100, currentReading: 158, usage: 58, automaticCharge: null,
      unitPrice: null, resolvedUnitPrice: 125.5, discountType: null, discountAmount: null,
    });
  });

  it("listUtilityRows: 스냅샷 단가와 현재 해석 단가를 각각 매핑", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 101, unit_no: "101호", dong: null, occupancy_id: 9, tenant_name: "홍길동",
      occupancy_status: "occupied", move_in_date: null, customer_no: "W-101", meter_no: null,
      previous_reading: 100, current_reading: 110, usage: 10, unit_price: 850, calc_charge: 8500,
      discount_amount: 0, manual_charge: null, note: null, processed_at: null, discount_type: null,
      resolved_unit_price: 900,
    }], error: null });

    const [row] = await listUtilityRows(3, "water", "2026-08-01");

    expect(row).toMatchObject({ unitPrice: 850, resolvedUnitPrice: 900, automaticCharge: 8500 });
  });

  it("listUtilityRows: 수도 할인 세대 매핑", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 201, unit_no: "201호", dong: null, occupancy_id: 5, tenant_name: "김수급",
      occupancy_status: "occupied", move_in_date: null, customer_no: "W-201", meter_no: null,
      previous_reading: null, current_reading: null, usage: null, unit_price: null, calc_charge: null,
      discount_amount: 3000, manual_charge: null, note: null, processed_at: null, discount_type: "recipient",
      resolved_unit_price: null,
    }], error: null });
    const [row] = await listUtilityRows(3, "water", "2026-08-01");
    expect(row).toMatchObject({ discountType: "recipient", discountAmount: 3000 });
  });

  it("saveMeterReadings: save_meter_readings payload + 결과", async () => {
    rpc.mockResolvedValue({ data: { saved: 2, period: "2026-08-01" }, error: null });
    const res = await saveMeterReadings({
      buildingId: 3, utilityType: "water", period: "2026-08-01",
      rows: [{ unit_id: 101, current_reading: "158", manual_charge: "", note: "" }],
    });
    expect(rpc).toHaveBeenCalledWith("save_meter_readings", {
      p_building_id: 3, p_utility: "water", p_period: "2026-08-01",
      p_rows: [{ unit_id: 101, current_reading: "158", manual_charge: "", note: "" }],
    });
    expect(res).toEqual({ saved: 2, period: "2026-08-01" });
  });

  it("saveWaterDiscount: unit_id onConflict upsert", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ upsert });
    await saveWaterDiscount({ unitId: 101, discountType: "multichild", amount: 5000, memo: "3자녀" });
    expect(from).toHaveBeenCalledWith("water_discounts");
    expect(upsert).toHaveBeenCalledWith(
      { unit_id: 101, discount_type: "multichild", amount: 5000, memo: "3자녀" },
      { onConflict: "unit_id" },
    );
  });

  it("deleteWaterDiscount: unit_id 삭제", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn(() => ({ eq }));
    from.mockReturnValue({ delete: del });
    await deleteWaterDiscount(101);
    expect(eq).toHaveBeenCalledWith("unit_id", 101);
  });

  it("건물·유형별 고정 사용량을 unit_meters에서 조회하고 숫자로 매핑한다", async () => {
    const not = vi.fn().mockResolvedValue({
      data: [{ unit_id: 101, fixed_usage: "12.50", units: { building_id: 3 } }],
      error: null,
    });
    const is = vi.fn(() => ({ not }));
    const buildingEq = vi.fn(() => ({ is }));
    const utilityEq = vi.fn(() => ({ eq: buildingEq }));
    const select = vi.fn(() => ({ eq: utilityEq }));
    from.mockReturnValue({ select });

    await expect(listFixedUsages(3, "electricity")).resolves.toEqual([
      { unitId: 101, fixedUsage: 12.5 },
    ]);

    expect(from).toHaveBeenCalledWith("unit_meters");
    expect(select).toHaveBeenCalledWith(
      "unit_id, fixed_usage, units!inner(building_id)",
    );
    expect(utilityEq).toHaveBeenCalledWith("utility", "elec");
    expect(buildingEq).toHaveBeenCalledWith("units.building_id", 3);
    expect(is).toHaveBeenCalledWith("units.deleted_at", null);
    expect(not).toHaveBeenCalledWith("fixed_usage", "is", null);

    const query = useFixedUsages(3, "electricity") as unknown as {
      queryKey: readonly unknown[];
    };
    expect(query.queryKey).toEqual(utilityKeys.fixedUsages(3, "electricity"));
  });

  it("고정 사용량은 세대·유형 키로 설정하고 null로 해제한다", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValueOnce({ upsert });

    await setFixedUsage({
      buildingId: 3,
      unitId: 101,
      utilityType: "electricity",
      fixedUsage: 12.5,
    });
    expect(upsert).toHaveBeenCalledWith(
      { unit_id: 101, utility: "elec", fixed_usage: 12.5 },
      { onConflict: "unit_id,utility" },
    );

    const utilityEq = vi.fn().mockResolvedValue({ error: null });
    const unitEq = vi.fn(() => ({ eq: utilityEq }));
    const update = vi.fn(() => ({ eq: unitEq }));
    from.mockReturnValueOnce({ update });

    await clearFixedUsage({ buildingId: 3, unitId: 101, utilityType: "gas" });
    expect(update).toHaveBeenCalledWith({ fixed_usage: null });
    expect(unitEq).toHaveBeenCalledWith("unit_id", 101);
    expect(utilityEq).toHaveBeenCalledWith("utility", "gas");
  });

  it("listMeterHistory: 유형(elec) + period 이하 6건 + charge=calc?? manual", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [
      { period: "2026-08-01", manual_charge: 12000, calc_charge: 10000, unit_price: 1000 },
      { period: "2026-07-01", manual_charge: null, calc_charge: 9000, unit_price: 900 },
    ], error: null });
    const order = vi.fn(() => ({ limit }));
    const lte = vi.fn(() => ({ order }));
    const eq2 = vi.fn(() => ({ lte }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    from.mockReturnValue({ select: () => ({ eq: eq1 }) });
    const hist = await listMeterHistory(101, "electricity", "2026-08-01");
    expect(from).toHaveBeenCalledWith("meter_readings");
    expect(eq2).toHaveBeenCalledWith("utility", "elec");
    expect(hist).toEqual([
      { period: "2026-08-01", charge: 12000, unitPrice: 1000 },
      { period: "2026-07-01", charge: 9000, unitPrice: 900 },
    ]);
  });

  it("단가 목록을 조회하고 snake_case를 매핑한다", async () => {
    rpc.mockResolvedValue({ data: [{
      customer_number_id: 11,
      customer_no: "E-1",
      holder_name: "상가용",
      sort_order: 2,
      unit_price: 125.5,
    }], error: null });

    await expect(listUtilityPrices(3, "electricity")).resolves.toEqual([{
      customerNumberId: 11,
      customerNo: "E-1",
      holderName: "상가용",
      sortOrder: 2,
      unitPrice: 125.5,
    }]);
    expect(rpc).toHaveBeenCalledWith("list_utility_prices", {
      p_building_id: 3,
      p_utility: "elec",
    });
  });

  it("고객번호별 단가를 원자 저장한다", async () => {
    rpc.mockResolvedValue({ data: { saved: 1 }, error: null });

    await expect(saveUtilityUnitPrices({
      buildingId: 3,
      utilityType: "electricity",
      prices: [{ customer_number_id: 11, unit_price: 125.5 }],
    })).resolves.toEqual({ saved: 1 });
    expect(rpc).toHaveBeenCalledWith("save_utility_unit_prices", {
      p_building_id: 3,
      p_utility: "elec",
      p_prices: [{ customer_number_id: 11, unit_price: 125.5 }],
    });
  });

  it("용도 기본 단가와 용도·층 단가를 원자 저장한 뒤 훅으로 조회한다", async () => {
    type StoredScopedPrice = {
      building_id: number;
      utility: string;
      usage_type: "residential" | "commercial";
      floor: number | null;
      unit_price: number;
    };
    let storedRows: StoredScopedPrice[] = [];
    const upsert = vi.fn(async (rows: StoredScopedPrice[]) => {
      storedRows = rows;
      return { error: null };
    });
    const utilityEq = vi.fn(async (_column: string, utility: string) => ({
      data: storedRows.filter((row) => row.utility === utility),
      error: null,
    }));
    const buildingEq = vi.fn(() => ({ eq: utilityEq }));
    const select = vi.fn(() => ({ eq: buildingEq }));
    from.mockReturnValue({ upsert, select });

    const rows = [
      { usage_type: "residential" as const, floor: null, unit_price: 850 },
      { usage_type: "commercial" as const, floor: 2, unit_price: 920.5 },
    ];
    await expect(saveScopedPrices(3, "electricity", rows)).resolves.toEqual({ saved: 2 });

    const query = useScopedPrices(3, "electricity") as unknown as {
      queryFn: () => Promise<typeof rows>;
    };
    await expect(query.queryFn()).resolves.toEqual(rows);
    expect(upsert).toHaveBeenCalledWith(
      rows.map((row) => ({ building_id: 3, utility: "elec", ...row })),
      { onConflict: "building_id,utility,usage_type,floor" },
    );
    expect(buildingEq).toHaveBeenCalledWith("building_id", 3);
    expect(utilityEq).toHaveBeenCalledWith("utility", "elec");
    expect(listScopedPrices).toBeTypeOf("function");
  });

  it("공과금 부과확정 결과를 camelCase로 매핑한다", async () => {
    rpc.mockResolvedValue({ data: { unit_count: 2, total: 60000 }, error: null });

    await expect(confirmUtilities({
      buildingId: 3,
      utilityType: "gas",
      period: "2026-08-01",
    })).resolves.toEqual({ unitCount: 2, total: 60000 });
    expect(rpc).toHaveBeenCalledWith("confirm_utilities", {
      p_building_id: 3,
      p_utility: "gas",
      p_period: "2026-08-01",
    });
  });

  it("확정상태 1행을 매핑하고 0행은 null을 반환한다", async () => {
    rpc
      .mockResolvedValueOnce({ data: [{
        confirmed_at: "2026-08-13T00:00:00Z",
        confirmed_by_name: "관리자",
        unit_count: 2,
        total_amount: 60000,
        is_dirty: true,
      }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    await expect(getUtilityConfirmation(3, "water", "2026-08-01")).resolves.toEqual({
      confirmedAt: "2026-08-13T00:00:00Z",
      confirmedByName: "관리자",
      unitCount: 2,
      totalAmount: 60000,
      isDirty: true,
    });
    await expect(getUtilityConfirmation(3, "gas", "2026-08-01")).resolves.toBeNull();
  });

  it("검침대장 URL에 건물·DB 유형·월을 직렬화한다", () => {
    expect(ledgerDownloadUrl(3, "electricity", "2026-08-01")).toBe(
      "/api/utilities/ledger?buildingId=3&utility=elec&period=2026-08-01",
    );
  });

  it("단가 저장 성공 시 단가와 해당 건물·유형 행을 무효화한다", () => {
    const input = {
      buildingId: 3,
      utilityType: "water" as const,
      prices: [{ customer_number_id: 11, unit_price: 850 }],
    };
    const mutation = useSaveUtilityUnitPrices() as unknown as {
      onSuccess: (result: { saved: number }, variables: typeof input) => void;
    };

    mutation.onSuccess({ saved: 1 }, input);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: utilityKeys.prices(3, "water") });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: utilityKeys.rowsScope(3, "water") });
  });

  it("용도/층별 단가 저장 성공 시 scoped 단가와 해당 건물·유형 행을 무효화한다", () => {
    const input = {
      buildingId: 3,
      utilityType: "electricity" as const,
      rows: [{ usage_type: "commercial" as const, floor: 2, unit_price: 920.5 }],
    };
    const mutation = useSaveScopedPrices() as unknown as {
      onSuccess: (result: { saved: number }, variables: typeof input) => void;
    };

    mutation.onSuccess({ saved: 1 }, input);

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: utilityKeys.scopedPrices(3, "electricity"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: utilityKeys.rowsScope(3, "electricity"),
    });
  });

  it("고정 사용량 설정·해제 성공 시 고정 사용량과 해당 행 범위를 무효화한다", () => {
    const setInput = {
      buildingId: 3,
      unitId: 101,
      utilityType: "electricity" as const,
      fixedUsage: 12.5,
    };
    const setMutation = useSetFixedUsage() as unknown as {
      onSuccess: (result: void, variables: typeof setInput) => void;
    };

    setMutation.onSuccess(undefined, setInput);

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: utilityKeys.fixedUsages(3, "electricity"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: utilityKeys.rowsScope(3, "electricity"),
    });

    vi.clearAllMocks();
    const clearInput = {
      buildingId: 3,
      unitId: 101,
      utilityType: "electricity" as const,
    };
    const clearMutation = useClearFixedUsage() as unknown as {
      onSuccess: (result: void, variables: typeof clearInput) => void;
    };

    clearMutation.onSuccess(undefined, clearInput);

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: utilityKeys.fixedUsages(3, "electricity"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: utilityKeys.rowsScope(3, "electricity"),
    });
  });

  it("확정 성공 시 확정상태와 해당 월 행을 무효화한다", () => {
    const input = { buildingId: 3, utilityType: "gas" as const, period: "2026-08-01" };
    const mutation = useConfirmUtilities() as unknown as {
      onSuccess: (result: { unitCount: number; total: number }, variables: typeof input) => void;
    };

    mutation.onSuccess({ unitCount: 2, total: 60000 }, input);

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: utilityKeys.confirmation(3, "gas", "2026-08-01"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: utilityKeys.rows(3, "gas", "2026-08-01"),
    });
  });

  it("RPC 오류를 전달한다", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "조회 실패" } });
    await expect(listUtilityRows(3, "water", "2026-08-01")).rejects.toThrow("조회 실패");
  });
});
