import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

import { listPaymentRows, recordPayment, cancelPayment } from "./apis";

beforeEach(() => rpc.mockReset());

describe("listPaymentRows", () => {
  it("row를 camelCase + unpaid/payStatus로 매핑", async () => {
    rpc.mockResolvedValue({
      data: [{
        unit_id: 1, unit_no: "101", dong: "A", occupancy_id: 9, tenant_name: "김철수",
        is_vacant: false, is_auto_debit: true, due_date: "2026-08-25", charged: 10000, paid: 4000,
      }], error: null,
    });
    const rows = await listPaymentRows(1, "2026-08-01");
    expect(rpc).toHaveBeenCalledWith("list_payment_rows", { p_building_id: 1, p_period: "2026-08-01" });
    expect(rows[0]).toMatchObject({
      unitId: 1, unitNo: "101", tenantName: "김철수", isAutoDebit: true,
      charged: 10000, paid: 4000, unpaid: 6000, payStatus: "partial",
    });
  });
  it("charged null이면 unpaid null + unbilled", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 2, unit_no: "102", dong: null, occupancy_id: null, tenant_name: null,
      is_vacant: true, is_auto_debit: false, due_date: null, charged: null, paid: 0,
    }], error: null });
    const rows = await listPaymentRows(1, "2026-08-01");
    expect(rows[0].unpaid).toBeNull();
    expect(rows[0].payStatus).toBe("unbilled");
  });
  it("error는 throw", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(listPaymentRows(1, "2026-08-01")).rejects.toThrow("boom");
  });
});

describe("recordPayment", () => {
  it("입력을 snake_case p_* 인자로 전달하고 balance 반환", async () => {
    rpc.mockResolvedValue({ data: { ok: true, payment_id: 5, charged: 10000, paid: 10000, unpaid: 0 }, error: null });
    const res = await recordPayment({ unitId: 1, period: "2026-08-01", amount: 6000, method: "transfer", kind: "partial", memo: "메모" });
    expect(rpc).toHaveBeenCalledWith("record_payment", {
      p_unit_id: 1, p_period: "2026-08-01", p_amount: 6000,
      p_method: "transfer", p_kind: "partial", p_memo: "메모", p_paid_at: null,
    });
    expect(res).toMatchObject({ charged: 10000, paid: 10000, unpaid: 0 });
  });
});

describe("cancelPayment", () => {
  it("payment_id 전달", async () => {
    rpc.mockResolvedValue({ data: { ok: true, unit_id: 1, period: "2026-08-01", charged: 10000, paid: 0, unpaid: 10000 }, error: null });
    await cancelPayment(5);
    expect(rpc).toHaveBeenCalledWith("cancel_payment", { p_payment_id: 5 });
  });
});
