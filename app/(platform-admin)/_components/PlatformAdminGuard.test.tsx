import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useMe = vi.fn();
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: () => useMe() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import { PlatformAdminGuard } from "./PlatformAdminGuard";

function context(role: string) {
  return {
    data: {
      orgId: 1,
      role,
      orgStatus: "active",
      username: "tester",
      fullName: "테스터",
      isActive: true,
      mustChangePassword: false,
      staffType: "manager_staff",
      permissions: [],
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  };
}

describe("PlatformAdminGuard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("platform_admin은 플랫폼 화면을 표시한다", () => {
    useMe.mockReturnValue(context("platform_admin"));
    render(<PlatformAdminGuard><div>플랫폼 콘텐츠</div></PlatformAdminGuard>);
    expect(screen.getByText("플랫폼 콘텐츠")).toBeInTheDocument();
  });

  it.each(["org_owner", "staff"])("%s는 권한 없음 화면과 직원 화면 링크를 표시한다", (role) => {
    useMe.mockReturnValue(context(role));
    render(<PlatformAdminGuard><div>플랫폼 콘텐츠</div></PlatformAdminGuard>);
    expect(screen.queryByText("플랫폼 콘텐츠")).toBeNull();
    expect(screen.getByText("플랫폼 관리 권한이 없습니다")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "직원 화면으로 돌아가기" })).toHaveAttribute("href", "/staff");
  });

  it("인증 컨텍스트가 없으면 HQ 로그인 링크를 표시한다", () => {
    useMe.mockReturnValue({
      data: null,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<PlatformAdminGuard><div>플랫폼 콘텐츠</div></PlatformAdminGuard>);
    expect(screen.getByRole("link", { name: "로그인으로 이동" })).toHaveAttribute(
      "href",
      "/platform-admin/login",
    );
  });
});
