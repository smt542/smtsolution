import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({
  back: vi.fn(),
  params: { period: "2026-08" },
}));
const guard = vi.hoisted(() => ({ useResidentGuard: vi.fn() }));
const billing = vi.hoisted(() => ({
  useCreateBillToken: vi.fn(),
  useResidentBillDetail: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => nav.params,
  useRouter: () => ({ back: nav.back }),
}));
vi.mock("@/lib/resident/useResidentGuard", () => guard);
vi.mock("@/hooks/reactquery/residentBilling", () => billing);

import ResidentBillDetailPage from "./page";

const detail = {
  period: "2026-08-01",
  buildingName: "그린빌라",
  unitNo: "201호",
  tenantName: "김주민",
  totalAmount: 120000,
  paidAmount: 20000,
  unpaidAmount: 100000,
  dueDate: "2026-08-25",
  confirmedAt: "2026-08-10T00:00:00Z",
  items: [
    {
      feeItemId: 1,
      name: "일반관리비",
      amount: 120000,
      charged: true,
    },
  ],
  mgmtBank: "관리은행",
  mgmtAcct: "123-456",
  mgmtHolder: "그린관리",
};

const mutateAsync = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  guard.useResidentGuard.mockReturnValue({
    loading: false,
    link: { buildingName: "그린빌라", unitNo: "201호" },
    error: null,
    retry: vi.fn(),
  });
  billing.useResidentBillDetail.mockReturnValue({
    data: detail,
    error: null,
    isPending: false,
    refetch: vi.fn(),
  });
  billing.useCreateBillToken.mockReturnValue({
    mutateAsync,
    isPending: false,
    error: null,
  });
  mutateAsync.mockResolvedValue("11111111-2222-4333-8444-555555555555");
});

describe("ResidentBillDetailPage", () => {
  it("converts the segment to an ISO month date and shows loading", () => {
    billing.useResidentBillDetail.mockReturnValue({
      data: undefined,
      error: null,
      isPending: true,
      refetch: vi.fn(),
    });

    render(<ResidentBillDetailPage />);

    expect(billing.useResidentBillDetail).toHaveBeenCalledWith("2026-08-01");
    expect(screen.getByRole("status")).toHaveTextContent(
      "관리비 상세를 불러오고 있어요",
    );
  });

  it("shows an empty state when the detail RPC returns zero rows", () => {
    billing.useResidentBillDetail.mockReturnValue({
      data: null,
      error: null,
      isPending: false,
      refetch: vi.fn(),
    });

    render(<ResidentBillDetailPage />);

    expect(screen.getByText("부과 내역이 없어요")).toBeInTheDocument();
  });

  it("renders authed detail and copies the exact account and amount format", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");

    render(<ResidentBillDetailPage />);

    expect(screen.getByText("김주민 님")).toBeInTheDocument();
    expect(screen.getByText("2026.08 관리비")).toBeInTheDocument();
    expect(screen.getByText("일반관리비")).toBeInTheDocument();
    expect(screen.getByText("그린관리")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "계좌·금액 복사" }));
    expect(writeText).toHaveBeenCalledWith("관리은행 123-456 100,000원");

    await user.click(screen.getByRole("button", { name: "무로그인 링크 복사" }));
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith("2026-08-01");
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/r/11111111-2222-4333-8444-555555555555`,
      );
    });
  });
});
