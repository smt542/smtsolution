// lib/bill/document.test.ts
import { describe, it, expect } from "vitest";
import {
  BILL_QR_PLACEHOLDER_BASE,
  billDocumentTotal,
  buildAdjustmentRows,
  buildQrPayload,
  formatBillAmount,
  giroDocumentAmount,
  printableAccounts,
  unitLabel,
} from "./document";

describe("bill/document", () => {
  it("unitLabel: 세대별 이름 출력 유형과 폴백을 적용", () => {
    expect(unitLabel("none", "101", "홍길동", "김납부", "P-101")).toBe("");
    expect(unitLabel("name", "101", "홍길동", "김납부", "P-101")).toBe("김납부");
    expect(unitLabel("name", "101", "홍길동", "  ")).toBe("홍길동");
    expect(unitLabel("name", "101", "  ", null)).toBe("101");
    expect(unitLabel("code", "101", "홍길동", "김납부", "P-101")).toBe("P-101");
    expect(unitLabel("code", "101", "홍길동", "김납부", "  ")).toBe("101");
  });
  it("buildQrPayload: base 없으면 플레이스홀더", () => {
    expect(buildQrPayload(7, "2026-08-01")).toBe(`${BILL_QR_PLACEHOLDER_BASE}?unit=7&period=2026-08-01`);
    expect(buildQrPayload(7, "2026-08-01", "https://x.io/a")).toBe("https://x.io/a?unit=7&period=2026-08-01");
  });
  it("printableAccounts: mgmtPrint true + 값 있는 계좌만", () => {
    const cfg = { mgmtBank1: "국민", mgmtAcct1: "123", mgmtHolder1: "관리", mgmtPrint1: true,
                  mgmtBank2: "신한", mgmtAcct2: "456", mgmtHolder2: "관리", mgmtPrint2: false };
    expect(printableAccounts(cfg)).toEqual([{ bank: "국민", acct: "123", holder: "관리" }]);
    expect(printableAccounts(null)).toEqual([]);
  });
  it("billDocumentTotal: charged 항목만 합산", () => {
    expect(billDocumentTotal([
      { feeItemId: 1, name: "관리비", charged: true, amount: 30000 },
      { feeItemId: 2, name: "수도", charged: false, amount: 5000 },
    ])).toBe(30000);
  });
  it("지로 금액은 확정 totalAmount를 사용하고 원화로 포맷", () => {
    const document = {
      totalAmount: 35400,
      items: [{ feeItemId: 1, name: "관리비", charged: true, amount: 30000 }],
    };
    expect(giroDocumentAmount(document)).toBe(35400);
    expect(formatBillAmount(giroDocumentAmount(document))).toBe("35,400원");
  });
  it("조정명세서는 전월·당월 확정액과 항목 증감을 계산", () => {
    const common = { unitId: 1, unitNo: "101", dong: null, tenantName: "홍길동", autoDebit: true };
    const rows = buildAdjustmentRows(
      [{ ...common, totalAmount: 38000, items: [
        { feeItemId: 1, name: "관리비", charged: true, amount: 30000 },
        { feeItemId: 2, name: "수도", charged: true, amount: 8000 },
      ] }],
      [{ ...common, totalAmount: 35000, items: [
        { feeItemId: 1, name: "관리비", charged: true, amount: 30000 },
        { feeItemId: 2, name: "수도", charged: true, amount: 5000 },
      ] }],
    );
    expect(rows[0]).toMatchObject({ previousTotal: 35000, currentTotal: 38000, totalDelta: 3000 });
    expect(rows[0].lines.find((line) => line.feeItemId === 2)).toMatchObject({
      previousAmount: 5000,
      currentAmount: 8000,
      delta: 3000,
    });
  });
});
