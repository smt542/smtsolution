import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeeItemFormModal } from "./FeeItemFormModal";

function renderModal(onSubmit = vi.fn().mockResolvedValue(undefined), onClose = vi.fn()) {
  render(<FeeItemFormModal open editing={null} onClose={onClose} onSubmit={onSubmit} isPending={false} />);
  return { onSubmit, onClose };
}

describe("management FeeItemFormModal form contract", () => {
  it("성공 시 검증된 값을 제출하고 닫는다", async () => {
    const { onSubmit, onClose } = renderModal();
    fireEvent.change(screen.getByLabelText("항목명칭"), { target: { value: " 청소비 " } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: "청소비",
      rounding: "round",
      dailyProration: false,
      carryOver: false,
    })));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("검증 실패 시 첫 오류 필드 포커스와 ARIA 연결을 제공한다", async () => {
    const { onSubmit } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    const name = screen.getByLabelText("항목명칭");
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAttribute("aria-describedby", "management-fee-item-name-error");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("서버 실패는 전역 오류로 표시하고 모달을 유지한다", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("관리비 항목 저장 실패"));
    const { onClose } = renderModal(onSubmit);
    fireEvent.change(screen.getByLabelText("항목명칭"), { target: { value: "청소비" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("관리비 항목 저장 실패");
    expect(onClose).not.toHaveBeenCalled();
  });
});
