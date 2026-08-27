import { describe, it, expect, vi, beforeEach } from "vitest";
const rpc = vi.fn();
const occupancyIn = vi.fn();
const unitAccountIn = vi.fn();
const organizationMaybeSingle = vi.fn();
const from = vi.fn((table: string) => {
  if (table === "occupancies") return { select: () => ({ in: occupancyIn }) };
  if (table === "unit_accounts") return { select: () => ({ eq: () => ({ in: unitAccountIn }) }) };
  if (table === "organizations") return { select: () => ({ eq: () => ({ maybeSingle: organizationMaybeSingle }) }) };
  throw new Error(`unexpected table ${table}`);
});
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc, from }) }));
import { listBillTargets, getBillDocuments, getOrganizationName, issueBills, recordBillDelivery, sendBillFaxes } from "./apis";
beforeEach(() => {
  vi.clearAllMocks();
  occupancyIn.mockResolvedValue({ data: [{ id: 5, payer_name: "김납부", bill_name_display: "code" }], error: null });
  unitAccountIn.mockResolvedValue({ data: [{ unit_id: 1, payer_no: "P-101" }], error: null });
  organizationMaybeSingle.mockResolvedValue({ data: { name: "한빛관리" }, error: null });
});

describe("bill apis", () => {
  it("listBillTargets: list_bill_targets 호출·snake→camel", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 1, unit_no: "101", dong: null, occupancy_id: 5, tenant_name: "홍", phone: "010", phone2: "0102", fax_number: "02-1111",
      total_amount: 30000, auto_debit: true, issue_type: "a4", due_date: "2026-08-25", send_status: "none", issued_at: "2026-08-13T00:00:00Z",
      single_print: true, water_cutoff: false, scheduled_at: null, message_schedule_id: null,
      kakao_send_status: null, fax_send_status: "sent",
    }], error: null });
    const r = await listBillTargets(7, "2026-08-01");
    expect(rpc).toHaveBeenCalledWith("list_bill_targets", { p_building_id: 7, p_period: "2026-08-01" });
    expect(occupancyIn).toHaveBeenCalledWith("id", [5]);
    expect(unitAccountIn).toHaveBeenCalledWith("unit_id", [1]);
    expect(r[0]).toMatchObject({
      unitId: 1,
      tenantName: "홍",
      payerName: "김납부",
      payerNo: "P-101",
      billNameDisplay: "code",
      totalAmount: 30000,
      autoDebit: true,
      issueType: "a4",
      issuedAt: "2026-08-13T00:00:00Z",
      secondaryPhone: "0102",
      faxNumber: "02-1111",
      singlePrint: true,
      waterCutoff: false,
      faxSendStatus: "sent",
    });
  });
  it("listBillTargets: occupancy와 unit account 보강 조회를 병렬 실행", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 1, unit_no: "101", dong: null, occupancy_id: 5, tenant_name: "홍", phone: "010", phone2: null, fax_number: null,
      total_amount: 30000, auto_debit: false, issue_type: null, due_date: null, send_status: null, issued_at: null,
      single_print: false, water_cutoff: false, scheduled_at: null, message_schedule_id: null,
      kakao_send_status: null, fax_send_status: null,
    }], error: null });

    let resolveOccupancy!: (value: {
      data: { id: number; payer_name: string; bill_name_display: string }[];
      error: null;
    }) => void;
    let resolveAccount!: (value: {
      data: { unit_id: number; payer_no: string }[];
      error: null;
    }) => void;
    occupancyIn.mockReturnValueOnce(new Promise((resolve) => {
      resolveOccupancy = resolve;
    }));
    unitAccountIn.mockReturnValueOnce(new Promise((resolve) => {
      resolveAccount = resolve;
    }));

    const resultPromise = listBillTargets(7, "2026-08-01");

    await vi.waitFor(() => {
      expect(occupancyIn).toHaveBeenCalledOnce();
      expect(unitAccountIn).toHaveBeenCalledOnce();
    });
    resolveOccupancy({
      data: [{ id: 5, payer_name: "김납부", bill_name_display: "code" }],
      error: null,
    });
    resolveAccount({ data: [{ unit_id: 1, payer_no: "P-101" }], error: null });

    await expect(resultPromise).resolves.toEqual([
      expect.objectContaining({ payerName: "김납부", payerNo: "P-101", billNameDisplay: "code" }),
    ]);
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
  it("issueBills: 회차별 단수 세대를 명시", async () => {
    rpc.mockResolvedValue({ data: { count: 2 }, error: null });
    await issueBills({
      buildingId: 7, period: "2026-08-01", unitIds: [1, 2], issueType: "giro",
      dueDate: null, unitLabelMode: "name", waterCutoffUnitIds: [2],
    });
    expect(rpc).toHaveBeenCalledWith("issue_bills", expect.objectContaining({ p_water_cutoff_unit_ids: [2] }));
  });
  it("카톡 상태 기록과 팩스 스텁을 공용 bill delivery RPC로 전달", async () => {
    rpc.mockResolvedValue({ data: { count: 1 }, error: null });
    await recordBillDelivery({
      buildingId: 7, period: "2026-08-01", unitIds: [1], issueType: "kakao",
      sendStatus: "scheduled", messageScheduleId: 9, scheduledAt: "2026-08-20T00:00:00Z",
    });
    expect(rpc).toHaveBeenCalledWith("record_bill_delivery", expect.objectContaining({
      p_issue_type: "kakao", p_send_status: "scheduled", p_message_schedule_id: 9,
    }));
  });
  it("즉시 카톡 접수는 queued 상태와 message_log_id로 기록한다(sent 아님)", async () => {
    rpc.mockResolvedValue({ data: { count: 1 }, error: null });
    await recordBillDelivery({
      buildingId: 7, period: "2026-08-01", unitIds: [1], issueType: "kakao",
      sendStatus: "queued", messageLogId: 42,
    });
    expect(rpc).toHaveBeenCalledWith("record_bill_delivery", expect.objectContaining({
      p_issue_type: "kakao", p_send_status: "queued", p_message_log_id: 42,
    }));
  });
  it("팩스 발송은 fax bill_issue를 확보한 뒤 서버 라우트로 접수한다(가짜 sent 기록 없음)", async () => {
    rpc.mockResolvedValueOnce({ data: [{ bill_issue_id: 5, unit_id: 1 }], error: null });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ queued: 1, failed: 0 }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendBillFaxes({ buildingId: 7, period: "2026-08-01", unitIds: [1] });

    expect(rpc).toHaveBeenCalledWith("resolve_fax_bill_issues", {
      p_building_id: 7,
      p_period: "2026-08-01",
      p_unit_ids: [1],
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/bill/fax/send", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.billIssueIds).toEqual([5]);
    expect(result).toEqual({ queued: 1, failed: 0 });
    vi.unstubAllGlobals();
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
