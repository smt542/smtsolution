import { describe, it, expect, vi, beforeEach } from "vitest";
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
import { listBilling, listBillingHistory, saveBillingCharges, confirmBilling } from "./apis";
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
});
