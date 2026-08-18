import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/payments", () => ({
  useUnitPayments: vi.fn(() => ({
    data: [{
      id: 31,
      amount: 60_000,
      method: "transfer",
      kind: "partial",
      memo: null,
      paidAt: "2026-08-15",
      status: "active",
      createdAt: "2026-08-15T09:00:00Z",
    }],
    isLoading: false,
  })),
}));

import { PaymentHistoryModal } from "./PaymentHistoryModal";

describe("PaymentHistoryModal", () => {
  it("개별 수납 건에서 영수증 출력 진입점을 제공한다", () => {
    const onReceipt = vi.fn();
    render(
      <PaymentHistoryModal
        open
        unitId={11}
        period="2026-08-01"
        isPending={false}
        onClose={vi.fn()}
        onCancel={vi.fn()}
        onReceipt={onReceipt}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "영수증" }));

    expect(onReceipt).toHaveBeenCalledWith(expect.objectContaining({ id: 31 }));
  });
});
