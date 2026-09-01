import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import type { MyContext } from "@/hooks/reactquery/auth/apis";

/* ── mocks ──────────────────────────────────────────────────────────────── */

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/staff/buildings"),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: mockReplace, refresh: vi.fn() })),
}));

// Mock sonner toast (logout error path)
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Mock next/link — render as a plain <a>
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    "aria-current": ariaCurrent,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    "aria-current"?: React.AriaAttributes["aria-current"];
  }) => (
    <a href={href} className={className} aria-current={ariaCurrent}>
      {children}
    </a>
  ),
}));

// Mock @/hooks/reactquery/auth
const mockUseMe = vi.fn();
const mockLogoutMutate = vi.fn().mockResolvedValue(undefined);
vi.mock("@/hooks/reactquery/auth", () => ({
  useMe: () => mockUseMe(),
  useLogout: () => ({ mutateAsync: mockLogoutMutate, isPending: false }),
}));

/* ── helpers ─────────────────────────────────────────────────────────────── */

function makeMe(overrides: Partial<MyContext>): { data: MyContext } {
  const base: MyContext = {
    orgId: 1,
    role: "manager",
    orgStatus: "active",
    username: "testuser",
    fullName: "테스트",
    isActive: true,
    mustChangePassword: false,
    staffType: "manager_staff",
    permissions: [],
    ...overrides,
  };
  return { data: base };
}

/* ── tests ───────────────────────────────────────────────────────────────── */

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue("/staff/buildings");
  });

  it("Test A: org_owner sees the full Figma office navigation", () => {
    mockUseMe.mockReturnValue(
      makeMe({ role: "org_owner", permissions: [] })
    );

    render(<Sidebar />);

    expect(screen.getByText("건물·입주자 관리")).toBeInTheDocument();
    expect(screen.getByText("협력업체 관리")).toBeInTheDocument();
    expect(screen.getByText("공지 관리")).toBeInTheDocument();
  });

  it("Test B: manager with only buildings permission sees only the matching menu", () => {
    mockUseMe.mockReturnValue(
      makeMe({ role: "manager", permissions: ["buildings"] })
    );

    render(<Sidebar />);

    expect(screen.getByText("건물·입주자 관리")).toBeInTheDocument();
    expect(screen.queryByText("협력업체 관리")).toBeNull();
    expect(screen.queryByText("장기수선비 관리")).toBeNull();
  });

  it("장기수선비 권한 직원에게 장기수선비 관리 링크를 노출한다", () => {
    mockUseMe.mockReturnValue(makeMe({ role: "manager", permissions: ["long_term_repair"] }));

    render(<Sidebar />);

    expect(screen.getByRole("link", { name: /장기수선비 관리/ })).toHaveAttribute(
      "href",
      "/staff/long-term-repair",
    );
  });

  it("Test C: active item on /staff/buildings has aria-current=page", () => {
    mockUseMe.mockReturnValue(
      makeMe({ role: "org_owner", permissions: [] })
    );

    render(<Sidebar />);

    // 건물·입주자 is a built:true item → rendered as <a>
    const link = screen.getByRole("link", { name: /건물·입주자/ });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveClass("bg-teal-t", "text-teal-d");
  });

  it("고객번호 조회 경로에서 공과금 메뉴를 펼치고 고객번호만 활성 표시한다", () => {
    vi.mocked(usePathname).mockReturnValue("/staff/customer-numbers");
    mockUseMe.mockReturnValue(makeMe({ role: "manager", permissions: ["utilities"] }));

    render(<Sidebar />);

    expect(screen.getByRole("link", { name: "공과금 관리" })).toBeInTheDocument();
    const customerNumberLink = screen.getByRole("link", { name: "고객번호 조회" });
    expect(customerNumberLink).toHaveAttribute("aria-current", "page");
    expect(customerNumberLink).toHaveClass("bg-teal-t", "text-teal-d");
    expect(screen.getByRole("link", { name: "가스" })).not.toHaveAttribute("aria-current");
  });

  it("Figma 공통 브랜드 마크와 워드마크를 사용한다", () => {
    mockUseMe.mockReturnValue(makeMe({ role: "org_owner", permissions: [] }));

    render(<Sidebar />);

    const brandLink = screen.getByRole("link", { name: "관리비서" });
    expect(brandLink.querySelector("img")?.getAttribute("src")).toContain("%2Flogo-mark.png");
    expect(screen.getByText("비서")).toHaveClass("text-teal");
  });

  it("platform_admin에게 통합관리자 콘솔 링크를 노출한다", () => {
    mockUseMe.mockReturnValue(
      makeMe({ role: "platform_admin", permissions: [] })
    );

    render(<Sidebar />);

    expect(screen.getByRole("link", { name: "통합관리자 콘솔" })).toHaveAttribute(
      "href",
      "/platform-admin"
    );
  });

  it("platform_admin이 아닌 사용자에게 통합관리자 콘솔 링크를 숨긴다", () => {
    mockUseMe.mockReturnValue(
      makeMe({ role: "org_owner", permissions: [] })
    );

    render(<Sidebar />);

    expect(screen.queryByRole("link", { name: "통합관리자 콘솔" })).not.toBeInTheDocument();
  });

  it("프로필 메뉴에서 로그아웃 클릭 시 로그아웃 후 로그인 화면으로 이동한다", async () => {
    mockUseMe.mockReturnValue(makeMe({ role: "org_owner" }));

    render(<Sidebar />);

    // 로그아웃은 프로필 메뉴 안에 있다 — 프로필 버튼을 눌러 메뉴를 먼저 연다
    fireEvent.click(screen.getByRole("button", { name: /테스트/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /로그아웃/ }));

    await waitFor(() => expect(mockLogoutMutate).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith("/staff/login");
  });
});
