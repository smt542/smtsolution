import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getResidentBillPageData: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("./data", () => ({
  getResidentBillPageData: mocks.getResidentBillPageData,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/resident/bill",
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import ResidentBillLoading from "./loading";
import ResidentBillPage from "./page";

const linkedHousehold = {
  buildingName: "그린빌라",
  unitNo: "201호",
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

const renderPage = async () => render(<>{await ResidentBillPage()}</>);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getResidentBillPageData.mockResolvedValue({
    link: linkedHousehold,
    months,
  });
});

describe("ResidentBillPage", () => {
  it("shows the route loading state and refreshes a failed server request", async () => {
    const loading = render(<ResidentBillLoading />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "관리비 내역을 불러오고 있어요",
    );
    loading.unmount();

    mocks.getResidentBillPageData.mockRejectedValue(new Error("failed"));
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("shows the required empty state", async () => {
    mocks.getResidentBillPageData.mockResolvedValue({
      link: linkedHousehold,
      months: [],
    });

    await renderPage();

    expect(screen.getByText("부과 내역이 없어요")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "주요 메뉴" }),
    ).toBeInTheDocument();
  });

  it("renders the canon header, year toggle, summary, and month rows", async () => {
    await renderPage();

    expect(mocks.getResidentBillPageData).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "관리비" })).toBeInTheDocument();
    expect(screen.getByText("그린빌라 201호")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "2026년" })).toBeInTheDocument();
    expect(screen.getByText("2026년 합계")).toBeInTheDocument();
    expect(screen.getByText("2개월")).toBeInTheDocument();
    expect(screen.getByText("226,800")).toBeInTheDocument();
    expect(screen.getByText("113,400원")).toBeInTheDocument();
    expect(screen.getByText("106,800원")).toBeInTheDocument();
    expect(screen.getByText("2건")).toBeInTheDocument();
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
