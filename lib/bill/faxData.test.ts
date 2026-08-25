import { describe, expect, it, vi } from "vitest";
import { FaxDocumentError, loadFaxDocumentData } from "./faxData";

const okRow = {
  ok: true,
  bill_issue_id: 5,
  org_id: 10,
  company_name: "한빛관리",
  building: { id: 3, name: "그린빌라", address: "서울" },
  unit_id: 11,
  unit_no: "101",
  dong: "A",
  period: "2026-08",
  tenant_name: "홍길동",
  payer_name: null,
  payer_no: "P-101",
  bill_name_display: "name",
  phone: "010-1",
  fax_number: "02-333-4444",
  auto_debit: true,
  amount: 123000,
  items: [{ feeItemId: 1, name: "관리비", charged: true, amount: 123000 }],
  unit_notice: null,
  customer_notice: "안내",
  due_date: "2026-09-05",
  mgmt_bank1: "국민", mgmt_acct1: "1-2", mgmt_holder1: "관리단", mgmt_print1: true,
  mgmt_bank2: null, mgmt_acct2: null, mgmt_holder2: null, mgmt_print2: false,
};

describe("loadFaxDocumentData", () => {
  it("RPC 권위 데이터를 계약으로 변환한다", async () => {
    const sb = { rpc: vi.fn().mockResolvedValue({ data: okRow, error: null }) };
    const doc = await loadFaxDocumentData(sb, 5);
    expect(sb.rpc).toHaveBeenCalledWith("load_fax_document", { p_bill_issue_id: 5 });
    expect(doc).toMatchObject({ orgId: 10, unitNo: "101", amount: 123000, faxNumber: "02-333-4444" });
    expect(doc.accounts).toHaveLength(1);
  });

  it("bill issue를 찾지 못하면 코드와 함께 던진다", async () => {
    const sb = { rpc: vi.fn().mockResolvedValue({ data: { ok: false, code: "BILL_ISSUE_NOT_FOUND" }, error: null }) };
    const err = (await loadFaxDocumentData(sb, 9).catch((e) => e)) as FaxDocumentError;
    expect(err).toBeInstanceOf(FaxDocumentError);
    expect(err.code).toBe("BILL_ISSUE_NOT_FOUND");
  });
});
