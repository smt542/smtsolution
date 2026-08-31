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
  it("수납관리·민원접수는 payment 또는 complaints 권한으로 활성화", () => {
    expect(all.find((i) => i.href === "/staff/receipts")).toMatchObject({
      label: "수납관리·민원접수",
      modules: ["payment", "complaints"],
      built: true,
    });
  });
  it("수납처리 독립 항목 제거(수납관리·민원접수로 통합)", () => {
    expect(all.find((i) => i.href === "/staff/payment")).toBeUndefined();
  });
  it("문자·알림톡 발송은 messaging 권한으로 활성화", () => {
    expect(all.find((i) => i.href === "/staff/messaging")).toMatchObject({
      label: "문자·알림톡 발송",
      module: "messaging",
      built: true,
    });
  });
  it("장기수선비 관리는 기존 setup과 같은 settings 권한으로 활성화", () => {
    expect(all.find((i) => i.href === "/staff/long-term-repair")).toMatchObject({
      label: "장기수선비 관리",
      module: "settings",
      built: true,
    });
  });
});
