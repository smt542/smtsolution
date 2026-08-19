import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({ useResidentGuard: vi.fn() }));
const billing = vi.hoisted(() => ({ useResidentBillMonths: vi.fn() }));
const notices = vi.hoisted(() => ({ useResidentNotices: vi.fn() }));
const profiles = vi.hoisted(() => ({ useResidentProfile: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => "/resident/home" }));
vi.mock("@/lib/resident/useResidentGuard", () => guard);
vi.mock("@/hooks/reactquery/residentBilling", () => billing);
vi.mock("@/hooks/reactquery/residentNotices", () => notices);
vi.mock("@/hooks/reactquery/residentProfile", () => profiles);
vi.mock("@/app/(resident)/_components/MoveOutSection", () => ({
  default: () => <section aria-label="퇴실 신청">퇴실 신청 영역</section>,
}));

import ResidentHomePage from "./page";

const queryBase = { error: null, isPending: false, refetch: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  guard.useResidentGuard.mockReturnValue({
    loading: false,
    link: { buildingName: "해오름빌라", unitNo: "201호", tenantName: "김주민" },
    error: null,
    retry: vi.fn(),
  });
  profiles.useResidentProfile.mockReturnValue({
    ...queryBase,
    data: {
      tenantName: "김주민",
      buildingName: "해오름빌라",
      unitNo: "201호",
      orgName: "해오름관리",
    },
  });
  billing.useResidentBillMonths.mockReturnValue({
    ...queryBase,
    data: [
      {
        period: "2026-08-01",
        totalAmount: 120000,
        paidAmount: 20000,
        unpaidAmount: 100000,
        dueDate: "2026-08-25",
      },
      {
        period: "2026-07-01",
        totalAmount: 100000,
        paidAmount: 100000,
        unpaidAmount: 0,
        dueDate: "2026-07-25",
      },
      {
        period: "2026-06-01",
        totalAmount: 90000,
        paidAmount: 90000,
        unpaidAmount: 0,
        dueDate: "2026-06-25",
      },
    ],
  });
  notices.useResidentNotices.mockReturnValue({
    ...queryBase,
    data: [{ id: 7, title: "승강기 점검 안내", noticeType: "important" }],
  });
});

describe("ResidentHomePage", () => {
  it("composes profile, current bill, trend, latest notice, move-out, and nav", () => {
    render(<ResidentHomePage />);

    expect(screen.getByText("해오름빌라 201호")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "김주민 님" })).toBeInTheDocument();
    expect(screen.getByText("해오름관리")).toBeInTheDocument();
    expect(screen.getAllByText("100,000원")).toHaveLength(2);
    expect(screen.getByText("2026.08.25")).toBeInTheDocument();
    expect(screen.getByText("최근 관리비 추이")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /승강기 점검 안내/ })).toHaveAttribute("href", "/resident/notice/7");
    expect(screen.getByRole("link", { name: "상세 내역 보기" })).toHaveAttribute("href", "/resident/bill");
    expect(screen.getByLabelText("퇴실 신청")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("shows empty billing and notice states without dropping the hub", () => {
    billing.useResidentBillMonths.mockReturnValue({ ...queryBase, data: [] });
    notices.useResidentNotices.mockReturnValue({ ...queryBase, data: [] });
    render(<ResidentHomePage />);

    expect(screen.getByText("부과 내역이 없어요.")).toBeInTheDocument();
    expect(screen.getByText("새로운 공지가 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("표시할 관리비 추이가 없어요.")).toBeInTheDocument();
  });
});
