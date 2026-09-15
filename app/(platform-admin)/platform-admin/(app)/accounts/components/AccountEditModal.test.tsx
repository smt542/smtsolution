import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlatformAccount } from "@/hooks/reactquery/platform";
import { AccountEditModal } from "./AccountEditModal";

const account = {
  userId: "u1",
  username: "staff",
  fullName: "기존 이름",
  phone: "010-1111-2222",
  memo: "기존 메모",
  organizationName: "한빛관리",
} as PlatformAccount;

function renderModal(onSubmit = vi.fn().mockResolvedValue(undefined), onClose = vi.fn()) {
  render(<AccountEditModal account={account} onClose={onClose} onSubmit={onSubmit} isPending={false} />);
  return { onSubmit, onClose };
}

describe("AccountEditModal form contract", () => {
  it("성공 시 공백을 정규화해 제출하고 닫는다", async () => {
    const { onSubmit, onClose } = renderModal();
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: " 새 이름 " } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ fullName: "새 이름", phone: "010-1111-2222", memo: "기존 메모" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("검증 실패 시 이름 오류와 포커스를 연결한다", async () => {
    const { onSubmit } = renderModal();
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    const input = screen.getByLabelText("이름");
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "platform-account-edit-name-error");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("서버 실패는 전역 오류로 표시하고 닫지 않는다", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("저장 거부"));
    const { onClose } = renderModal(onSubmit);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("저장 거부");
    expect(onClose).not.toHaveBeenCalled();
  });
});
