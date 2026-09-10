import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getStaffContext: vi.fn() }));

vi.mock("../_staffContext", () => ({ getStaffContext: mocks.getStaffContext }));
vi.mock("@/components/vendors/VendorManagementSection", () => ({
  VendorManagementSection: () => <div>VENDOR_MANAGEMENT</div>,
}));

import VendorManagementPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStaffContext.mockResolvedValue({
    orgId: 9,
    role: "manager",
    permissions: ["vendors"],
  });
});

describe("VendorManagementPage", () => {
  it("협력업체 관리 화면을 독립 라우트에서 렌더한다", async () => {
    render(await VendorManagementPage());

    expect(screen.getByText("VENDOR_MANAGEMENT")).toBeInTheDocument();
  });

  it("vendors 권한이 없으면 접근을 차단한다", async () => {
    mocks.getStaffContext.mockResolvedValue({
      orgId: 9,
      role: "manager",
      permissions: ["settings"],
    });

    render(await VendorManagementPage());

    expect(screen.getByText("권한이 없습니다")).toBeInTheDocument();
    expect(screen.queryByText("VENDOR_MANAGEMENT")).not.toBeInTheDocument();
  });
});
