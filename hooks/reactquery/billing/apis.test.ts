import { describe, it, expect, vi, beforeEach } from "vitest";
const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc, from }) }));
import {
  listBilling,
  listBillingHistory,
  saveBillingCharges,
  confirmBilling,
  getBillingPeriodSetting,
  saveBillingPeriodSetting,
  listUnchargedNewOccupancies,
  chargeNewOccupancies,
  copyPreviousBilling,
} from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("billing apis", () => {
  it("listBilling: list_billing 호출, snake→camel 매핑", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 1, unit_no: "101", dong: null, room_type_label: "원룸",
      occupancy_id: 5, tenant_name: "홍", move_in_date: "2026-08-01", is_vacant: false,
      fee_item_id: 10, fee_item_name: "관리비", carry_over: false, daily_proration: false,
      rounding: "round", is_required: true, sort_order: 0, charged: true, amount: 30000,
      confirmed_at: null, confirmed_by_name: null, total_amount: null,
      billing_note: null, unit_notice: null, is_dirty: false,
    }], error: null });
    const r = await listBilling(7, "2026-08-01");
    expect(rpc).toHaveBeenCalledWith("list_billing", { p_building_id: 7, p_period: "2026-08-01" });
    expect(r[0]).toMatchObject({ unitId: 1, feeItemId: 10, feeItemName: "관리비", amount: 30000, isVacant: false });
  });
  it("saveBillingCharges: charges/notes를 snake로 전송", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await saveBillingCharges({
      buildingId: 7, period: "2026-08-01",
      charges: [{ unitId: 1, feeItemId: 10, charged: true, amount: 30000, occupancyId: 5 }],
      notes: [{ unitId: 1, billingNote: "메모", unitNotice: null }],
    });
    expect(rpc).toHaveBeenCalledWith("save_billing_charges", expect.objectContaining({
      p_building_id: 7, p_period: "2026-08-01",
      p_charges: [{ unit_id: 1, fee_item_id: 10, charged: true, amount: 30000, occupancy_id: 5 }],
      p_notes: [{ unit_id: 1, billing_note: "메모", unit_notice: null }],
    }));
  });
  it("copyPreviousBilling: 이월 항목과 한 달 이동한 부과 일정을 반영한다", async () => {
    const row = {
      unit_id: 1, unit_no: "101", dong: null, room_type_label: "원룸",
      occupancy_id: 5, tenant_name: "홍", move_in_date: "2026-07-01", is_vacant: false,
      fee_item_id: 10, fee_item_name: "관리비", carry_over: true, daily_proration: false,
      rounding: "round", is_required: true, sort_order: 0, charged: true, amount: 30000,
      confirmed_at: null, confirmed_by_name: null, total_amount: null,
      billing_note: "전월 메모", unit_notice: "전월 공지", is_dirty: false,
    };
    rpc
      .mockResolvedValueOnce({ data: [row], error: null })
      .mockResolvedValueOnce({ data: [{ ...row, occupancy_id: 9, amount: 0, billing_note: null, unit_notice: null }], error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const previousSetting = {
      building_id: 7, period: "2026-07-01", charge_start_date: "2026-06-16",
      charge_end_date: "2026-07-15", due_date: "2026-07-25",
    };
    const nextSetting = {
      building_id: 7, period: "2026-08-01", charge_start_date: "2026-07-16",
      charge_end_date: "2026-08-15", due_date: "2026-08-25",
    };
    const maybeSingle = vi.fn().mockResolvedValue({ data: previousSetting, error: null });
    const secondEq = vi.fn(() => ({ maybeSingle }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const single = vi.fn().mockResolvedValue({ data: nextSetting, error: null });
    const selectAfterUpsert = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select: selectAfterUpsert }));
    from
      .mockReturnValueOnce({ select: () => ({ eq: firstEq }) })
      .mockReturnValueOnce({ upsert });

    await expect(copyPreviousBilling(7, "2026-08-01")).resolves.toEqual({ unitCount: 1, chargeCount: 1 });
    expect(rpc.mock.calls).toEqual([
      ["list_billing", { p_building_id: 7, p_period: "2026-07-01" }],
      ["list_billing", { p_building_id: 7, p_period: "2026-08-01" }],
      ["save_billing_charges", expect.objectContaining({
        p_building_id: 7,
        p_period: "2026-08-01",
        p_charges: [{ unit_id: 1, fee_item_id: 10, charged: true, amount: 30000, occupancy_id: 9 }],
        p_notes: [],
      })],
    ]);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      period: "2026-08-01",
      charge_start_date: "2026-07-16",
      charge_end_date: "2026-08-15",
      due_date: "2026-08-25",
    }), { onConflict: "building_id,period" });
  });
  it("confirmBilling: 결과 매핑", async () => {
    rpc.mockResolvedValue({ data: { unit_count: 3, total: 90000 }, error: null });
    const r = await confirmBilling(7, "2026-08-01");
    expect(rpc).toHaveBeenCalledWith("confirm_billing", { p_building_id: 7, p_period: "2026-08-01" });
    expect(r).toEqual({ unitCount: 3, total: 90000 });
  });
  it("listBillingHistory: months 기본 6, items 매핑", async () => {
    rpc.mockResolvedValue({ data: [{ period: "2026-08-01", total_amount: 90000,
      items: [{ fee_item_id: 10, name: "관리비", charged: true, amount: 30000 }], confirmed_at: "2026-08-13T00:00:00Z" }], error: null });
    const r = await listBillingHistory(1, "2026-08-01");
    expect(rpc).toHaveBeenCalledWith("list_billing_history", { p_unit_id: 1, p_period: "2026-08-01", p_months: 6 });
    expect(r[0]).toMatchObject({ period: "2026-08-01", totalAmount: 90000, items: [{ feeItemId: 10, name: "관리비", charged: true, amount: 30000 }] });
  });
  it("에러 시 throw", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(listBilling(7, "2026-08-01")).rejects.toThrow("boom");
  });

  it("getBillingPeriodSetting: 미저장 월분은 전월 16일~당월 15일과 빈 납기일", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const secondEq = vi.fn(() => ({ maybeSingle }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    from.mockReturnValue({ select: () => ({ eq: firstEq }) });

    await expect(getBillingPeriodSetting(7, "2026-08-01")).resolves.toEqual({
      buildingId: 7,
      period: "2026-08-01",
      chargeStartDate: "2026-07-16",
      chargeEndDate: "2026-08-15",
      dueDate: null,
      isSaved: false,
    });
  });

  it("getBillingPeriodSetting: 저장된 건물·월분의 날짜와 납기일을 로드", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: {
      building_id: 7,
      period: "2026-08-01",
      charge_start_date: "2026-07-17",
      charge_end_date: "2026-08-16",
      due_date: "2026-08-25",
    }, error: null });
    const secondEq = vi.fn(() => ({ maybeSingle }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    from.mockReturnValue({ select: () => ({ eq: firstEq }) });

    await expect(getBillingPeriodSetting(7, "2026-08-01")).resolves.toMatchObject({
      buildingId: 7,
      period: "2026-08-01",
      chargeStartDate: "2026-07-17",
      chargeEndDate: "2026-08-16",
      dueDate: "2026-08-25",
      isSaved: true,
    });
  });

  it("saveBillingPeriodSetting: 건물·월분별 날짜를 upsert하고 저장값을 반환", async () => {
    const row = {
      building_id: 7,
      period: "2026-08-01",
      charge_start_date: "2026-07-17",
      charge_end_date: "2026-08-16",
      due_date: "2026-08-25",
    };
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    from.mockReturnValue({ upsert });

    const result = await saveBillingPeriodSetting({
      buildingId: 7,
      period: "2026-08-01",
      chargeStartDate: "2026-07-17",
      chargeEndDate: "2026-08-16",
      dueDate: "2026-08-25",
    });

    expect(upsert).toHaveBeenCalledWith({
      building_id: 7,
      period: "2026-08-01",
      charge_start_date: "2026-07-17",
      charge_end_date: "2026-08-16",
      due_date: "2026-08-25",
    }, { onConflict: "building_id,period" });
    expect(result).toMatchObject({ dueDate: "2026-08-25", isSaved: true });
  });

  it("listUnchargedNewOccupancies: list_uncharged_new_occupancies 호출 + snake→camel", async () => {
    rpc.mockResolvedValue({ data: [
      { unit_id: 3, unit_no: "301", dong: "A", tenant_name: "김신규", move_in_date: "2026-08-20" },
    ], error: null });
    const r = await listUnchargedNewOccupancies(7, "2026-08-01");
    expect(rpc).toHaveBeenCalledWith("list_uncharged_new_occupancies", { p_building_id: 7, p_period: "2026-08-01" });
    expect(r[0]).toMatchObject({ unitId: 3, unitNo: "301", dong: "A", tenantName: "김신규", moveInDate: "2026-08-20" });
  });

  it("chargeNewOccupancies: charge_new_occupancies 호출 + 결과 매핑", async () => {
    rpc.mockResolvedValue({ data: { unit_count: 2, total: 60000 }, error: null });
    const r = await chargeNewOccupancies(7, "2026-08-01", [3, 4]);
    expect(rpc).toHaveBeenCalledWith("charge_new_occupancies", { p_building_id: 7, p_period: "2026-08-01", p_unit_ids: [3, 4] });
    expect(r).toEqual({ unitCount: 2, total: 60000 });
  });
});
