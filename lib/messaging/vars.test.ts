import { describe, expect, it } from "vitest";
import {
  formatAccount,
  formatDate,
  formatKrw,
  formatPeriodMonth,
  formatUnit,
} from "./vars";

describe("messaging template variable formatters", () => {
  it("formatKrw: 원 단위 숫자를 구분자 문자열로 만들고 0을 보존한다", () => {
    expect(formatKrw(120_000)).toBe("120,000");
    expect(formatKrw(0)).toBe("0");
    expect(formatKrw(null)).toBe("미확정");
    expect(formatKrw(Number.NaN)).toBe("미확정");
  });

  it("formatPeriodMonth: 월 또는 날짜 문자열을 한국어 연월로 만든다", () => {
    expect(formatPeriodMonth("2026-08")).toBe("2026년 8월");
    expect(formatPeriodMonth("2026-08-31")).toBe("2026년 8월");
    expect(formatPeriodMonth(null)).toBe("미확정");
    expect(formatPeriodMonth("미확정")).toBe("미확정");
  });

  it("formatDate: 날짜/일시를 YYYY-MM-DD로 만들고 미확정값을 표시한다", () => {
    expect(formatDate("2026-08-31")).toBe("2026-08-31");
    expect(formatDate("2026-08-31T23:59:59+09:00")).toBe("2026-08-31");
    expect(formatDate(null)).toBe("미확정");
    expect(formatDate("2026-02-30")).toBe("미확정");
  });

  it("formatUnit: 동·호 접미사를 중복 없이 조합한다", () => {
    expect(formatUnit("101", "1001")).toBe("101동 1001호");
    expect(formatUnit("101동", "1001호")).toBe("101동 1001호");
    expect(formatUnit(null, "1001")).toBe("1001호");
    expect(formatUnit(null, null)).toBe("미확정");
  });

  it("formatAccount: 은행과 계좌를 조합하고 없는 값은 미확정 처리한다", () => {
    expect(formatAccount("국민은행", "123-456-789")).toBe(
      "국민은행 123-456-789",
    );
    expect(formatAccount(null, "123-456-789")).toBe("123-456-789");
    expect(formatAccount(null, null)).toBe("미확정");
  });
});
