import { describe, expect, it } from "vitest";
import { endOfDayIso, startOfDayIso } from "./constants";

describe("receipt date filters", () => {
  it("브라우저 시간대와 무관하게 한국 날짜 경계를 사용한다", () => {
    expect(startOfDayIso("2026-08-01")).toBe("2026-07-31T15:00:00.000Z");
    expect(endOfDayIso("2026-08-01")).toBe("2026-08-01T14:59:59.999Z");
  });

  it("빈 날짜는 필터에서 제외한다", () => {
    expect(startOfDayIso("")).toBeUndefined();
    expect(endOfDayIso("")).toBeUndefined();
  });
});
