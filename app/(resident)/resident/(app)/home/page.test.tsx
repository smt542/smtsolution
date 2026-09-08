import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({ useResidentGuard: vi.fn() }));
const billing = vi.hoisted(() => ({ useResidentBillMonths: vi.fn() }));
const notices = vi.hoisted(() => ({
  useResidentNotices: vi.fn(),
  useResidentNoticeDetail: vi.fn(),
}));
const profiles = vi.hoisted(() => ({ useResidentProfile: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => "/resident/home" }));
vi.mock("@/lib/resident/useResidentGuard", () => guard);
vi.mock("@/hooks/reactquery/residentBilling", () => billing);
vi.mock("@/hooks/reactquery/residentNotices", () => notices);
vi.mock("@/hooks/reactquery/residentProfile", () => profiles);

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
      kakaoName: "김주민",
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
        paidAmount: 0,
        unpaidAmount: 120000,
        lateFee: 6800,
        payStatus: "unpaid",
        dueDate: "2026-08-25",
      },
      {
        period: "2026-07-01",
        totalAmount: 100000,
        paidAmount: 100000,
        unpaidAmount: 0,
        lateFee: 0,
        payStatus: "paid",
        dueDate: "2026-07-25",
      },
      {
        period: "2026-06-01",
        totalAmount: 90000,
        paidAmount: 90000,
        unpaidAmount: 0,
        lateFee: 0,
        payStatus: "paid",
        dueDate: "2026-06-25",
      },
    ],
  });
  notices.useResidentNotices.mockReturnValue({
    ...queryBase,
    data: [
      {
        id: 7,
        title: "승강기 점검 안내",
        noticeType: "important",
        buildingId: 1,
        buildingName: "해오름빌라",
        publishedAt: "2026-08-10T00:00:00Z",
        createdAt: "2026-08-10T00:00:00Z",
      },
    ],
  });
  notices.useResidentNoticeDetail.mockReturnValue({
    ...queryBase,
    data: {
      id: 7,
      title: "승강기 점검 안내",
      content: "8월 15일 승강기 정기 점검이 있습니다.",
      noticeType: "important",
      buildingId: 1,
      buildingName: "해오름빌라",
      publishedAt: "2026-08-10T00:00:00Z",
      createdAt: "2026-08-10T00:00:00Z",
    },
  });
});

describe("ResidentHomePage", () => {
  it("renders the canon header, bill card with total + late fee, trend, notice, move-out, and nav", () => {
    render(<ResidentHomePage />);

    // 헤더: 건물·호수 = 제목, 카카오 실명 · 관리주체 = 서브라인
    expect(
      screen.getByRole("heading", { name: "해오름빌라 201호" }),
    ).toBeInTheDocument();
    expect(screen.getByText("김주민 님 · 해오름관리")).toBeInTheDocument();
    // 알림 벨 → 공지 목록
    expect(screen.getByRole("link", { name: /공지사항/ })).toHaveAttribute(
      "href",
      "/resident/notice",
    );

    // 관리비 카드: 상태칩 + 총 청구액(당월부과 120,000 + 연체료 6,800) + 항목
    expect(screen.getByText("2026년 8월 관리비")).toBeInTheDocument();
    expect(screen.getByText("미납")).toBeInTheDocument();
    expect(screen.getByText("126,800")).toBeInTheDocument();
    expect(screen.getByText("8월 25일")).toBeInTheDocument();
    expect(screen.getByText("당월 부과액")).toBeInTheDocument();
    expect(screen.getByText("연체료")).toBeInTheDocument();
    expect(screen.getByText("6,800원")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "상세 내역 보기" }),
    ).toHaveAttribute("href", "/resident/bill");

    // 추이: 당월 vs 3개월 평균 비교 + 평균/이번 달 footer
    expect(screen.getByText("16,667원")).toBeInTheDocument();
    expect(screen.getByText("많아요")).toBeInTheDocument();
    expect(screen.getByText("103,333원")).toBeInTheDocument();

    // 공지 카드(정본 = 모달) + 재사용 컴포넌트
    expect(
      screen.getByText("8월 15일 승강기 정기 점검이 있습니다."),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("opens the notice in a modal and closes it", () => {
    render(<ResidentHomePage />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /승강기 점검 안내/ }));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "승강기 점검 안내" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("8월 15일 승강기 정기 점검이 있습니다."),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "확인" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows empty billing, notice, and trend states without dropping the hub", () => {
    billing.useResidentBillMonths.mockReturnValue({ ...queryBase, data: [] });
    notices.useResidentNotices.mockReturnValue({ ...queryBase, data: [] });
    notices.useResidentNoticeDetail.mockReturnValue({
      ...queryBase,
      data: undefined,
    });
    render(<ResidentHomePage />);

    expect(screen.getByText("부과 내역이 없어요.")).toBeInTheDocument();
    expect(screen.getByText("새로운 공지가 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("표시할 관리비 추이가 없어요.")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});
