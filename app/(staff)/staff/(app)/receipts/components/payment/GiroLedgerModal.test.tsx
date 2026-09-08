import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/payments", () => ({
  useGiroPayments: vi.fn(),
  usePaymentRows: vi.fn(() => ({ data: [] })),
}));

import { useGiroPayments, usePaymentRows } from "@/hooks/reactquery/payments";
import { GiroLedgerModal } from "./GiroLedgerModal";

const rows = [
  {
    id: 5,
    unitNo: "101호",
    dong: "A동",
    tenantName: "김철수",
    amount: 30_000,
    paidAt: "2026-08-10",
    status: "active" as const,
    memo: "지로",
  },
  {
    id: 6,
    unitNo: "102호",
    dong: null,
    tenantName: null,
    amount: 40_000,
    paidAt: "2026-08-09",
    status: "canceled" as const,
    memo: null,
  },
];

function renderModal() {
  render(
    <GiroLedgerModal
      open
      buildingId={3}
      buildingName="해오름빌"
      period="2026-08-01"
      onClose={vi.fn()}
    />,
  );
}

beforeEach(() => {
  vi.mocked(usePaymentRows).mockReturnValue(
    { data: [] } as unknown as ReturnType<typeof usePaymentRows>,
  );
  vi.mocked(useGiroPayments).mockReturnValue(
    { data: rows, isLoading: false } as unknown as ReturnType<typeof useGiroPayments>,
  );
});

describe("GiroLedgerModal", () => {
  it("지로수납원장 헤더와 활성 행만 렌더", () => {
    renderModal();

    expect(screen.getByRole("columnheader", { name: "지로일자" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "실입금액" })).toBeInTheDocument();
    expect(screen.getByText("A동 101호")).toBeInTheDocument();
    expect(screen.getByText("인터넷지로")).toBeInTheDocument();
    // 취소 상태 행은 제외한다
    expect(screen.queryByText("102호")).toBeNull();
  });

  it("합계 요약을 표시", () => {
    renderModal();
    expect(screen.getByText(/총건수/)).toBeInTheDocument();
    expect(screen.getByText(/총 실입금액/)).toBeInTheDocument();
  });

  it("빈 배열이면 empty state를 렌더", () => {
    vi.mocked(useGiroPayments).mockReturnValue(
      { data: [], isLoading: false } as unknown as ReturnType<typeof useGiroPayments>,
    );

    renderModal();

    expect(screen.getByText("지로 수납 내역이 없습니다")).toBeInTheDocument();
  });
});
