import { describe, expect, it } from "vitest";

import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("converts the Korean country code to a domestic leading zero", () => {
    expect(normalizePhone("+82 10-1234-5678")).toBe("01012345678");
  });

  it("removes hyphens from a domestic number", () => {
    expect(normalizePhone("010-1234-5678")).toBe("01012345678");
  });

  it("preserves an already-normalized number", () => {
    expect(normalizePhone("01012345678")).toBe("01012345678");
  });
});
