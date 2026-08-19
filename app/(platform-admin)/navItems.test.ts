import { describe, expect, it } from "vitest";
import { PLATFORM_NAV_ITEMS, isPlatformNavActive, platformPageTitle } from "./navItems";

describe("platform admin navigation", () => {
  it("staff 내비게이션과 분리된 플랫폼 경로만 제공한다", () => {
    expect(PLATFORM_NAV_ITEMS).toHaveLength(6);
    expect(PLATFORM_NAV_ITEMS.every((item) => item.href.startsWith("/platform-admin"))).toBe(true);
    expect(PLATFORM_NAV_ITEMS).toContainEqual(expect.objectContaining({
      label: "설정",
      href: "/platform-admin/settings",
      description: "HQ 발송단가·청구계좌·부가세",
    }));
  });

  it("루트 메뉴는 하위 페이지에서 활성화되지 않는다", () => {
    expect(isPlatformNavActive("/platform-admin", "/platform-admin")).toBe(true);
    expect(isPlatformNavActive("/platform-admin/accounts", "/platform-admin")).toBe(false);
    expect(platformPageTitle("/platform-admin/accounts")).toBe("계정 관리");
    expect(platformPageTitle("/platform-admin/settings")).toBe("설정");
  });
});
