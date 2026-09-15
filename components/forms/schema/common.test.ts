import { describe, expect, it } from "vitest";
import {
  nullableDate,
  nullableDateTime,
  nullableInteger,
  nullableTrimmedString,
  optionalInteger,
  requiredDate,
  requiredInteger,
} from "./common";

describe("common form coercion", () => {
  it("숫자 입력은 숫자로 변환하되 빈 필수 값을 0으로 만들지 않는다", () => {
    expect(requiredInteger("필수").parse("12")).toBe(12);
    expect(requiredInteger("필수").safeParse("").success).toBe(false);
    expect(optionalInteger("숫자").parse("  ")).toBeUndefined();
    expect(nullableInteger("숫자").parse("")).toBeNull();
  });

  it("실재하는 날짜만 허용하고 선택 날짜·일시의 빈 값은 null로 통일한다", () => {
    expect(requiredDate("날짜").safeParse("2026-02-29").success).toBe(false);
    expect(requiredDate("날짜").parse("2026-09-15")).toBe("2026-09-15");
    expect(nullableDate("날짜").parse("")).toBeNull();
    expect(nullableDateTime("일시").parse("")).toBeNull();
    expect(nullableDateTime("일시").parse("2026-09-15T12:30")).toMatch(/^2026-09-15T/);
  });

  it("선택 문자열은 공백을 null로, 값은 trim된 문자열로 변환한다", () => {
    const schema = nullableTrimmedString(20, "문자열");
    expect(schema.parse("   ")).toBeNull();
    expect(schema.parse("  메모  ")).toBe("메모");
  });
});
