import { describe, it, expect } from "vitest";
import { NAV_GROUPS } from "./navItems";
const all = NAV_GROUPS.flatMap((g) => g.items);
describe("navItems P2b", () => {
  it("협력업체 독립 항목 제거", () => {
    expect(all.find((i) => i.href === "/staff/vendor-management")).toBeUndefined();
  });
  it("셋업 built:true", () => {
    expect(all.find((i) => i.href === "/staff/setup")?.built).toBe(true);
  });
});
