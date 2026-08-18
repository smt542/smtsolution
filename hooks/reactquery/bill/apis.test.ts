import { describe, it, expect, vi, beforeEach } from "vitest";
const rpc = vi.fn();
const occupancyIn = vi.fn();
const organizationMaybeSingle = vi.fn();
const from = vi.fn((table: string) => {
  if (table === "occupancies") return { select: () => ({ in: occupancyIn }) };
  if (table === "organizations") return { select: () => ({ eq: () => ({ maybeSingle: organizationMaybeSingle }) }) };
  throw new Error(`unexpected table ${table}`);
});
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc, from }) }));
import { listBillTargets, getBillDocuments, getOrganizationName, issueBills } from "./apis";
beforeEach(() => {
  vi.clearAllMocks();
  occupancyIn.mockResolvedValue({ data: [{ id: 5, payer_name: "김납부" }], error: null });
  organizationMaybeSingle.mockResolvedValue({ data: { name: "한빛관리" }, error: null });
});

describe("bill apis", () => {
  it("listBillTargets: list_bill_targets 호출·snake→camel", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 1, unit_no: "101", dong: null, occupancy_id: 5, tenant_name: "홍", phone: "010",
      total_amount: 30000, auto_debit: true, issue_type: "a4", due_date: "2026-08-25", send_status: "none", issued_at: "2026-08-13T00:00:00Z",
    }], error: null });
    const r = await listBillTargets(7, "2026-08-01");
    expect(rpc).toHaveBeenCalledWith("list_bill_targets", { p_building_id: 7, p_period: "2026-08-01" });
    expect(r[0]).toMatchObject({ unitId: 1, tenantName: "홍", payerName: "김납부", totalAmount: 30000, autoDebit: true, issueType: "a4", issuedAt: "2026-08-13T00:00:00Z" });
  });
  it("getBillDocuments: unit_ids 전송·items 매핑", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 1, unit_no: "101", dong: null, tenant_name: "홍", total_amount: 30000, auto_debit: false,
      items: [{ fee_item_id: 10, name: "관리비", charged: true, amount: 30000 }], billing_note: null, unit_notice: null,
    }], error: null });
    const r = await getBillDocuments(7, "2026-08-01", [1]);
    expect(rpc).toHaveBeenCalledWith("get_bill_documents", { p_building_id: 7, p_period: "2026-08-01", p_unit_ids: [1] });
    expect(r[0].items).toEqual([{ feeItemId: 10, name: "관리비", charged: true, amount: 30000 }]);
  });
  it("issueBills: payload snake 전송·count 반환", async () => {
    rpc.mockResolvedValue({ data: { count: 3 }, error: null });
    const r = await issueBills({ buildingId: 7, period: "2026-08-01", unitIds: [1, 2, 3], issueType: "a4", dueDate: "2026-08-25", unitLabelMode: "code" });
    expect(rpc).toHaveBeenCalledWith("issue_bills", { p_building_id: 7, p_period: "2026-08-01", p_unit_ids: [1, 2, 3], p_issue_type: "a4", p_due_date: "2026-08-25", p_unit_label_mode: "code" });
    expect(r).toEqual({ count: 3 });
  });
  it("에러 시 throw", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(listBillTargets(7, "2026-08-01")).rejects.toThrow("boom");
  });
  it("회사명은 현재 조직의 organizations.name을 조회", async () => {
    await expect(getOrganizationName(3)).resolves.toBe("한빛관리");
    expect(from).toHaveBeenCalledWith("organizations");
  });
});
