// lib/bill/document.test.ts
import { describe, it, expect } from "vitest";
import { unitLabel, buildQrPayload, printableAccounts, billDocumentTotal, BILL_QR_PLACEHOLDER_BASE } from "./document";

describe("bill/document", () => {
  it("unitLabel: name 모드는 입주자명, 없으면 코드 폴백", () => {
    expect(unitLabel("code", "101", "홍길동")).toBe("101");
    expect(unitLabel("name", "101", "홍길동")).toBe("홍길동");
    expect(unitLabel("name", "101", null)).toBe("101");
    expect(unitLabel("name", "101", "  ")).toBe("101");
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
});
