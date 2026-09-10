import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublicBillBySigned: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("./data", () => ({
  getPublicBillBySigned: mocks.getPublicBillBySigned,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import PublicBillLoading from "./loading";
import PublicSignedBillPage from "./page";

const publicBill = {
  period: "2026-08-01",
  buildingName: "그린빌라",
  unitNo: "201호",
  totalAmount: 120000,
  paidAmount: 0,
  unpaidAmount: 120000,
  lateFee: 0,
  dueDate: "2026-08-25",
  items: [
    {
      name: "수도료",
      amount: 20000,
      utility: "water" as const,
      usage: 8.2,
      prevUsage: 7.6,
    },
    {
      name: "일반관리비",
      amount: 100000,
      utility: null,
      usage: null,
      prevUsage: null,
    },
  ],
  mgmtBank: "관리은행",
  mgmtAcct: "123-456",
  mgmtHolder: "그린관리",
  expiresAt: "2027-08-31T00:00:00Z",
  isExpired: false,
};

const renderPage = async ({
  building = "7",
  unit = encodeURIComponent("201호"),
  period = "2026-08",
  sig = "signed-value",
}: {
  building?: string;
  unit?: string;
  period?: string;
  sig?: string | string[];
} = {}) =>
  render(
    <>
      {await PublicSignedBillPage({
        params: Promise.resolve({ building, unit, period }),
        searchParams: Promise.resolve({ s: sig }),
      })}
    </>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublicBillBySigned.mockResolvedValue(publicBill);
});

describe("PublicSignedBillPage", () => {
  it("shows the route loading state and refreshes a failed server request", async () => {
    const loading = render(<PublicBillLoading />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "관리비 고지서를 불러오고 있어요",
    );
    loading.unmount();

    mocks.getPublicBillBySigned.mockRejectedValue(new Error("failed"));
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("does not fetch when signed route parameters are invalid", async () => {
    await renderPage({ building: "0" });

    expect(screen.getByRole("status")).toHaveTextContent("유효하지 않은 링크");
    expect(mocks.getPublicBillBySigned).not.toHaveBeenCalled();
  });

  it("decodes the unit and renders the server-fetched bill", async () => {
    await renderPage({ sig: ["signed-value", "ignored"] });

    expect(mocks.getPublicBillBySigned).toHaveBeenCalledWith(
      7,
      "201호",
      "2026-08",
      "signed-value",
    );
    expect(screen.getByText("그린빌라 201호 · 2026년 8월 관리비")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "계좌 복사" })).toBeInTheDocument();
    expect(screen.getByText("이 링크는 관리비 확인 전용이며 2027.08.31까지 열람할 수 있습니다.")).toBeInTheDocument();
  });

  it("preserves invalid and expired bill states", async () => {
    mocks.getPublicBillBySigned
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...publicBill, isExpired: true });

    const view = await renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("유효하지 않은 링크");

    view.rerender(<>{await PublicSignedBillPage({
      params: Promise.resolve({
        building: "7",
        unit: encodeURIComponent("201호"),
        period: "2026-08",
      }),
      searchParams: Promise.resolve({ s: "signed-value" }),
    })}</>);
    expect(screen.getByRole("status")).toHaveTextContent("만료된 링크입니다");
    expect(screen.queryByText("120,000")).not.toBeInTheDocument();
  });
});
