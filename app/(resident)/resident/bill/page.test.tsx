import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({ useResidentGuard: vi.fn() }));
const billing = vi.hoisted(() => ({ useResidentBillMonths: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => "/resident/bill" }));
vi.mock("@/lib/resident/useResidentGuard", () => guard);
vi.mock("@/hooks/reactquery/residentBilling", () => billing);

import ResidentBillPage from "./page";

const linkedHousehold = {
  buildingName: "그린빌라",
  unitNo: "201호",
};

const readyGuard = {
  loading: false,
  link: linkedHousehold,
  error: null,
  retry: vi.fn(),
};

const months = [
  {
    period: "2026-08-01",
    totalAmount: 120000,
    paidAmount: 20000,
    unpaidAmount: 100000,
    lateFee: 6800,
    paidDate: "2026-08-05",
    payStatus: "partial",
    dueDate: "2026-08-25",
    confirmedAt: "2026-08-10T00:00:00Z",
  },
  {
    period: "2026-07-01",
    totalAmount: 100000,
    paidAmount: 100000,
    unpaidAmount: 0,
    lateFee: 0,
    paidDate: "2026-07-22",
    payStatus: "paid",
    dueDate: "2026-07-25",
    confirmedAt: "2026-07-10T00:00:00Z",
  },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  guard.useResidentGuard.mockReturnValue(readyGuard);
  billing.useResidentBillMonths.mockReturnValue({
    data: months,
    error: null,
    isPending: false,
    refetch: vi.fn(),
  });
});

describe("ResidentBillPage", () => {
  it("shows a loading state", () => {
    billing.useResidentBillMonths.mockReturnValue({
      data: undefined,
      error: null,
      isPending: true,
      refetch: vi.fn(),
    });

    render(<ResidentBillPage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "관리비 내역을 불러오고 있어요",
    );
  });

  it("shows the required empty state", () => {
    billing.useResidentBillMonths.mockReturnValue({
      data: [],
      error: null,
      isPending: false,
      refetch: vi.fn(),
    });

    render(<ResidentBillPage />);

    expect(screen.getByText("부과 내역이 없어요")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "주요 메뉴" }),
    ).toBeInTheDocument();
  });

  it("renders the canon header, year toggle, summary, and month rows", () => {
    render(<ResidentBillPage />);

    // 헤더 + 연도 pill
    expect(screen.getByRole("heading", { name: "관리비" })).toBeInTheDocument();
    expect(screen.getByText("그린빌라 201호")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "2026년" })).toBeInTheDocument();

    // 요약: 합계 = Σ(부과+연체료), 월평균, 미납 = Σ(미납+연체료)
    expect(screen.getByText("2026년 합계")).toBeInTheDocument();
    expect(screen.getByText("2개월")).toBeInTheDocument();
    expect(screen.getByText("226,800")).toBeInTheDocument();
    expect(screen.getByText("113,400원")).toBeInTheDocument();
    expect(screen.getByText("106,800원")).toBeInTheDocument();
    expect(screen.getByText("2건")).toBeInTheDocument();

    // 행: 총청구액 + 상태칩 + meta(완납=납부일 / 미납=납부기한·연체료)
    expect(screen.getByText("126,800원")).toBeInTheDocument();
    expect(screen.getByText("100,000원")).toBeInTheDocument();
    expect(screen.getByText("완납")).toBeInTheDocument();
    expect(screen.getByText("7월 22일 납부")).toBeInTheDocument();
    expect(screen.getByText("6,800원")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /8월/ })).toHaveAttribute(
      "href",
      "/resident/bill/2026-08",
    );
  });
});
