import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  refresh: vi.fn(),
  getResidentBillDetail: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mocks.back, refresh: mocks.refresh }),
}));
vi.mock("../data", () => ({
  getResidentBillDetail: mocks.getResidentBillDetail,
}));

import ResidentBillDetailLoading from "./loading";
import ResidentBillDetailPage from "./page";

const detail = {
  period: "2026-08-01",
  buildingName: "그린빌라",
  unitNo: "201호",
  tenantName: "김주민",
  totalAmount: 120000,
  paidAmount: 20000,
  unpaidAmount: 100000,
  lateFee: 0,
  dueDate: "2026-08-25",
  confirmedAt: "2026-08-10T00:00:00Z",
  items: [
    {
      feeItemId: 1,
      name: "일반관리비",
      amount: 120000,
      charged: true,
      utility: null,
      usage: null,
      prevUsage: null,
    },
  ],
  mgmtBank: "관리은행",
  mgmtAcct: "123-456",
  mgmtHolder: "그린관리",
};

const renderPage = async (period = "2026-08") =>
  render(
    <>
      {await ResidentBillDetailPage({
        params: Promise.resolve({ period }),
      })}
    </>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getResidentBillDetail.mockResolvedValue(detail);
});

describe("ResidentBillDetailPage", () => {
  it("shows the route loading state and refreshes a failed server request", async () => {
    const loading = render(<ResidentBillDetailLoading />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "관리비 상세를 불러오고 있어요",
    );
    loading.unmount();

    mocks.getResidentBillDetail.mockRejectedValue(new Error("failed"));
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("validates and converts the route segment before fetching", async () => {
    await renderPage();
    expect(mocks.getResidentBillDetail).toHaveBeenCalledWith("2026-08-01");

    await renderPage("invalid");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "유효하지 않은 관리비 기간입니다.",
    );
    expect(mocks.getResidentBillDetail).toHaveBeenCalledOnce();
  });

  it("shows an empty state when the detail RPC returns zero rows", async () => {
    mocks.getResidentBillDetail.mockResolvedValue(null);
    await renderPage();

    expect(screen.getByText("부과 내역이 없어요")).toBeInTheDocument();
  });

  it("renders the server detail and keeps back and copy interactions", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    await renderPage();

    expect(screen.getByText("2026년 8월 관리비")).toBeInTheDocument();
    expect(screen.getByText("일반관리비")).toBeInTheDocument();
    expect(screen.getByText("그린관리")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "뒤로가기" }));
    expect(mocks.back).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "계좌·금액 복사" }));
    expect(writeText).toHaveBeenCalledWith("관리은행 123-456 100,000원");
  });
});
