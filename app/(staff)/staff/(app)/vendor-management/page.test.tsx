import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import VendorManagementRedirect from "./page";

beforeEach(() => vi.clearAllMocks());

describe("vendor-management redirect", () => {
  it("셋업 시스템 탭으로 리다이렉트", () => {
    VendorManagementRedirect();
    expect(mocks.redirect).toHaveBeenCalledWith("/staff/setup?tab=system");
  });
});
