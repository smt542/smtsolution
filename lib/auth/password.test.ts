import { describe, expect, it } from "vitest";
import { generateTempPassword } from "./password";

describe("generateTempPassword", () => {
  it("최소 12자이며 호출마다 다르다", () => {
    const a = generateTempPassword();
    const b = generateTempPassword();
    expect(a.length).toBeGreaterThanOrEqual(12);
    expect(a).not.toEqual(b);
  });
});
