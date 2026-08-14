import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { guessColumns, parseAmount, parseBankWorkbook, toDeposits } from "./bankParse";

describe("parseAmount", () => {
  it("콤마·원·통화기호 제거", () => {
    expect(parseAmount("1,234")).toBe(1234);
    expect(parseAmount("₩10,000원")).toBe(10000);
    expect(parseAmount(" 5000 ")).toBe(5000);
  });
  it("빈값·비숫자 → 0", () => { expect(parseAmount("")).toBe(0); expect(parseAmount("-")).toBe(0); });
});

describe("guessColumns", () => {
  it("헤더 동의어로 열 추측", () => {
    const m = guessColumns(["입금일", "고객번호", "입금자명", "금액"]);
    expect(m).toEqual({ paidAt: 0, customerNo: 1, name: 2, amount: 3 });
  });
});

describe("toDeposits", () => {
  it("매핑으로 Deposit 생성·빈행 skip", () => {
    const rows = [["2026-08-10","C-1","홍길동","10,000"], ["","","",""]];
    const deps = toDeposits(rows, { paidAt: 0, customerNo: 1, name: 2, amount: 3 });
    expect(deps).toEqual([{ customerNo: "C-1", name: "홍길동", amount: 10000, paidAt: "2026-08-10", rowIndex: 0 }]);
  });
});

describe("parseBankWorkbook", () => {
  it("xlsx 버퍼 → headers/rows", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("S");
    ws.addRow(["고객번호", "입금자명", "금액"]);
    ws.addRow(["C-1", "홍길동", "10000"]);
    const buf = await wb.xlsx.writeBuffer();
    const parsed = await parseBankWorkbook(buf as ArrayBuffer);
    expect(parsed.headers).toEqual(["고객번호", "입금자명", "금액"]);
    expect(parsed.rows[0]).toEqual(["C-1", "홍길동", "10000"]);
  });
});
