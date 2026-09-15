import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeeItemFormDialog } from "./FeeItemFormDialog";

function renderDialog(onSubmit = vi.fn().mockResolvedValue(undefined), onClose = vi.fn()) {
  render(
    <FeeItemFormDialog
      open
      item={null}
      existingNames={[]}
      onClose={onClose}
      onSubmit={onSubmit}
      onDelete={vi.fn()}
    />,
  );
  return { onSubmit, onClose };
}

describe("FeeItemFormDialog form contract", () => {
  it("성공 시 정규화한 값을 제출하고 닫는다", async () => {
    const { onSubmit, onClose } = renderDialog();
    fireEvent.change(screen.getByLabelText("항목 명칭"), { target: { value: " 일반관리비 " } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      name: "일반관리비",
      rounding: "round",
      dailyProration: true,
      carryOver: false,
    }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("검증 실패 시 첫 필드에 포커스하고 ARIA로 오류를 연결한다", async () => {
    const { onSubmit } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    const name = screen.getByLabelText("항목 명칭");
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAttribute("aria-describedby", "fee-item-dialog-name-error");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("서버 실패는 전역 오류로 표시하고 닫지 않는다", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("항목 저장 실패"));
    const { onClose } = renderDialog(onSubmit);
    fireEvent.change(screen.getByLabelText("항목 명칭"), { target: { value: "일반관리비" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("항목 저장 실패");
    expect(onClose).not.toHaveBeenCalled();
  });
});
