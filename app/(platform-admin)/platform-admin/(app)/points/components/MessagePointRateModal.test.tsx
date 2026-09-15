import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessagePointRateModal } from "./MessagePointRateModal";

function renderModal(onSubmit = vi.fn().mockResolvedValue(undefined), onClose = vi.fn()) {
  render(<MessagePointRateModal open onClose={onClose} smsPoints={10} lmsPoints={20} alimtalkPoints={8} onSubmit={onSubmit} isPending={false} />);
  return { onSubmit, onClose };
}

describe("MessagePointRateModal form contract", () => {
  it("성공 시 숫자로 변환해 제출하고 닫는다", async () => {
    const { onSubmit, onClose } = renderModal();
    fireEvent.change(screen.getByLabelText("SMS 건당 포인트"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "단가 저장" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ smsPoints: 12, lmsPoints: 20, alimtalkPoints: 8 }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("빈 필수 숫자를 0으로 바꾸지 않고 필드 오류로 표시한다", async () => {
    const { onSubmit } = renderModal();
    fireEvent.change(screen.getByLabelText("SMS 건당 포인트"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "단가 저장" }));
    const input = screen.getByLabelText("SMS 건당 포인트");
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("서버 실패를 전역 오류로 표시한다", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("단가 저장 실패"));
    const { onClose } = renderModal(onSubmit);
    fireEvent.click(screen.getByRole("button", { name: "단가 저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("단가 저장 실패");
    expect(onClose).not.toHaveBeenCalled();
  });
});
