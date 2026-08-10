import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import type { MyContext } from "@/hooks/reactquery/auth/apis";

/* ── mocks ──────────────────────────────────────────────────────────────── */

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/staff/building-list"),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

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
vi.mock("@/hooks/reactquery/auth", () => ({
  useMe: () => mockUseMe(),
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
    permissions: [],
    ...overrides,
  };
  return { data: base };
}

/* ── tests ───────────────────────────────────────────────────────────────── */

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test A: org_owner sees all items including 건물·입주자 and 계정·직원 관리", () => {
    mockUseMe.mockReturnValue(
      makeMe({ role: "org_owner", permissions: [] })
    );

    render(<Sidebar />);

    expect(screen.getByText("건물·입주자")).toBeInTheDocument();
    expect(screen.getByText("계정·직원 관리")).toBeInTheDocument();
  });

  it("Test B: manager with only buildings permission sees 건물·입주자 but not 계정·직원 관리", () => {
    mockUseMe.mockReturnValue(
      makeMe({ role: "manager", permissions: ["buildings"] })
    );

    render(<Sidebar />);

    expect(screen.getByText("건물·입주자")).toBeInTheDocument();
    expect(screen.queryByText("계정·직원 관리")).toBeNull();
  });

  it("Test C: active item on /staff/building-list has aria-current=page", () => {
    mockUseMe.mockReturnValue(
      makeMe({ role: "org_owner", permissions: [] })
    );

    render(<Sidebar />);

    // 건물·입주자 is a built:true item → rendered as <a>
    const link = screen.getByRole("link", { name: /건물·입주자/ });
    expect(link).toHaveAttribute("aria-current", "page");
  });
});
