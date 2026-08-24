// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderFaxPdf } from "./faxPdf";
import type { FaxDocumentData } from "./document";

const doc: FaxDocumentData = {
  billIssueId: 5,
  orgId: 10,
  companyName: "한빛관리",
  building: { id: 3, name: "그린빌라", address: "서울시 강남구" },
  unitId: 11,
  unitNo: "101",
  dong: "A",
  period: "2026-08",
  householdName: "홍길동",
  phone: "010-1111-2222",
  faxNumber: "02-333-4444",
  autoDebit: true,
  amount: 123000,
  items: [{ feeItemId: 1, name: "일반관리비", charged: true, amount: 123000 }],
  accounts: [{ bank: "국민", acct: "123-456", holder: "관리단" }],
  customerNotice: "공용 안내입니다.",
  unitNotice: "세대 안내입니다.",
  dueDate: "2026-09-05",
  qrPayload: "https://bill.example.com/apply?document=giro&ref=11&period=2026-08",
};

describe("renderFaxPdf", () => {
  it("%PDF 헤더의 A4 PDF 버퍼를 생성한다(한글 포함)", async () => {
    const buffer = await renderFaxPdf(doc);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
  }, 30000);

  it("필수 데이터가 없으면 오류를 던진다", async () => {
    await expect(renderFaxPdf({ ...doc, unitNo: "" })).rejects.toThrow();
  });
});
