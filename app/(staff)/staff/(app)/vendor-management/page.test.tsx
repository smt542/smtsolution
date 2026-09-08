import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
import VendorManagementRedirect from "./page";
beforeEach(() => vi.clearAllMocks());
describe("vendor-management redirect", () => {
  it("셋업 시스템 탭으로 리다이렉트", () => {
    render(<VendorManagementRedirect />);
    expect(replace).toHaveBeenCalledWith("/staff/setup?tab=system");
  });
});
