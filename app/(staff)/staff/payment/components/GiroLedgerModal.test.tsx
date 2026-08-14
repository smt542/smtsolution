import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/payments", () => ({
  useGiroPayments: vi.fn(),
}));

import { useGiroPayments } from "@/hooks/reactquery/payments";
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

function renderModal(onCancel = vi.fn()) {
  render(
    <GiroLedgerModal
      open
      buildingId={3}
      period="2026-08-01"
      isPending={false}
      onClose={vi.fn()}
      onCancel={onCancel}
    />,
  );
  return onCancel;
}

beforeEach(() => {
  vi.mocked(useGiroPayments).mockReturnValue(
    { data: rows, isLoading: false } as unknown as ReturnType<typeof useGiroPayments>,
  );
});

describe("GiroLedgerModal", () => {
  it("지로 원장 행을 렌더", () => {
    renderModal();

    expect(screen.getByRole("columnheader", { name: "호실" })).toBeInTheDocument();
    expect(screen.getByText("A동 101호")).toBeInTheDocument();
    expect(screen.getByText("30,000")).toBeInTheDocument();
    expect(screen.getByText("2026-08-10")).toBeInTheDocument();
    expect(screen.getByText("완료")).toBeInTheDocument();
    expect(screen.getByText("취소", { selector: "td" })).toBeInTheDocument();
  });

  it("active 행 취소 버튼 클릭 시 onCancel 호출", () => {
    const onCancel = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(onCancel).toHaveBeenCalledWith(5);
  });

  it("빈 배열이면 empty state를 렌더", () => {
    vi.mocked(useGiroPayments).mockReturnValue(
      { data: [], isLoading: false } as unknown as ReturnType<typeof useGiroPayments>,
    );

    renderModal();

    expect(screen.getByText("지로 수납 내역이 없습니다")).toBeInTheDocument();
  });
});
