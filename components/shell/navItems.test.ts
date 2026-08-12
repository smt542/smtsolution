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
  it("민원·AS 접수는 complaints 권한으로 활성화", () => {
    expect(all.find((i) => i.href === "/staff/receipts")).toMatchObject({
      label: "민원·AS 접수",
      module: "complaints",
      built: true,
    });
  });
});
