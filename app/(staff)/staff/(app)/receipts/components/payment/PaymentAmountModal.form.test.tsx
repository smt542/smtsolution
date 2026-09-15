import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PaymentRow } from "@/hooks/reactquery/payments";
import { PaymentAmountModal } from "./PaymentAmountModal";

const row = {
  unitNo: "101호",
  dong: "A동",
  tenantName: "홍길동",
  isVacant: false,
} as PaymentRow;

function renderModal({
  defaultAmount = 10_000,
  onSubmit = vi.fn().mockResolvedValue(undefined),
  onClose = vi.fn(),
} = {}) {
  render(
    <PaymentAmountModal
      open
      row={row}
      kind="partial"
      defaultAmount={defaultAmount}
      isPending={false}
      onClose={onClose}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit, onClose };
}

describe("PaymentAmountModal form contract", () => {
  it("성공 시 숫자와 빈 문자열을 표준 값으로 변환하고 닫는다", async () => {
    const { onSubmit, onClose } = renderModal();
    fireEvent.change(screen.getByLabelText("수납금액"), { target: { value: "1200" } });
    fireEvent.change(screen.getByLabelText("수납방법"), { target: { value: "card" } });
    fireEvent.change(screen.getByLabelText("비고"), { target: { value: " 카드 수납 " } });
    fireEvent.click(screen.getByRole("button", { name: "수납 처리" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      amount: 1200,
      method: "card",
      memo: "카드 수납",
      paidAt: expect.any(String),
    })));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("검증 실패 시 금액 필드에 포커스하고 ARIA로 오류를 연결한다", async () => {
    const { onSubmit } = renderModal({ defaultAmount: 0 });
    fireEvent.click(screen.getByRole("button", { name: "수납 처리" }));

    const amount = screen.getByLabelText("수납금액");
    await waitFor(() => expect(amount).toHaveFocus());
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(amount).toHaveAttribute("aria-describedby", "payment-amount-error");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("서버 실패는 전역 오류로 표시하고 닫지 않는다", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("수납 저장 실패"));
    const { onClose } = renderModal({ onSubmit });
    fireEvent.click(screen.getByRole("button", { name: "수납 처리" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("수납 저장 실패");
    expect(onClose).not.toHaveBeenCalled();
  });
});
