import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({
  params: { token: "11111111-2222-4333-8444-555555555555" },
}));
const billing = vi.hoisted(() => ({ usePublicBillByToken: vi.fn() }));

vi.mock("next/navigation", () => ({ useParams: () => nav.params }));
vi.mock("@/hooks/reactquery/residentBilling", () => billing);

import PublicBillPage from "./page";

const publicDetail = {
  period: "2026-08-01",
  buildingName: "그린빌라",
  unitNo: "201호",
  totalAmount: 120000,
  paidAmount: 0,
  unpaidAmount: 120000,
  dueDate: "2026-08-25",
  items: [{ name: "일반관리비", amount: 120000 }],
  mgmtBank: "관리은행",
  mgmtAcct: "123-456",
  mgmtHolder: "그린관리",
  expiresAt: "2027-08-19T00:00:00Z",
  isExpired: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  billing.usePublicBillByToken.mockReturnValue({
    data: publicDetail,
    error: null,
    isPending: false,
    refetch: vi.fn(),
  });
});

describe("PublicBillPage", () => {
  it("shows a loading state", () => {
    billing.usePublicBillByToken.mockReturnValue({
      data: undefined,
      error: null,
      isPending: true,
      refetch: vi.fn(),
    });

    render(<PublicBillPage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "관리비 고지서를 불러오고 있어요",
    );
  });

  it("shows an invalid-link state for a zero-row RPC result", () => {
    billing.usePublicBillByToken.mockReturnValue({
      data: null,
      error: null,
      isPending: false,
      refetch: vi.fn(),
    });

    render(<PublicBillPage />);

    expect(screen.getByText("유효하지 않은 링크")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "관리비서 시작하기" })).not.toBeInTheDocument();
  });

  it("shows the expired state without leaking masked billing fields", () => {
    billing.usePublicBillByToken.mockReturnValue({
      data: {
        ...publicDetail,
        totalAmount: null,
        paidAmount: null,
        unpaidAmount: null,
        dueDate: null,
        items: [],
        mgmtBank: null,
        mgmtAcct: null,
        mgmtHolder: null,
        isExpired: true,
      },
      error: null,
      isPending: false,
      refetch: vi.fn(),
    });

    render(<PublicBillPage />);

    expect(screen.getByText("만료된 링크입니다")).toBeInTheDocument();
    expect(screen.queryByText("입금 계좌")).not.toBeInTheDocument();
  });

  it("renders a valid public bill and CTA without resident PII", () => {
    render(<PublicBillPage />);

    expect(billing.usePublicBillByToken).toHaveBeenCalledWith(
      "11111111-2222-4333-8444-555555555555",
    );
    expect(screen.getByText("그린빌라 201호")).toBeInTheDocument();
    expect(screen.getByText("일반관리비")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "관리비서 시작하기" })).toHaveAttribute(
      "href",
      "/resident/login",
    );
    expect(screen.queryByText(/김주민/)).not.toBeInTheDocument();
    expect(screen.queryByText(/010-/)).not.toBeInTheDocument();
  });
});
