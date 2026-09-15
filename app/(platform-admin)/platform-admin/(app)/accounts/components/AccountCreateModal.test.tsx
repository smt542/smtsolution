import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/platform", () => ({
  usePlatformOrganizations: () => ({
    data: { rows: [{ id: 7, name: "한빛관리", status: "active", deletedAt: null }] },
  }),
}));

import { AccountCreateModal } from "./AccountCreateModal";

function renderModal(onSubmit = vi.fn().mockResolvedValue(undefined), onClose = vi.fn()) {
  render(<AccountCreateModal open onClose={onClose} onSubmit={onSubmit} isPending={false} />);
  return { onSubmit, onClose };
}

describe("AccountCreateModal form contract", () => {
  it("성공 시 검증된 값을 제출하고 reset 후 닫는다", async () => {
    const { onSubmit, onClose } = renderModal();
    fireEvent.change(screen.getByLabelText("아이디"), { target: { value: " staff " } });
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: " 홍길동 " } });
    fireEvent.click(screen.getByRole("button", { name: "계정 발급" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ orgId: 7, username: "staff", fullName: "홍길동" })));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("검증 실패 시 첫 오류 필드에 포커스하고 ARIA로 오류를 연결한다", async () => {
    const { onSubmit } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "계정 발급" }));
    const username = await screen.findByLabelText("아이디");
    await waitFor(() => expect(username).toHaveFocus());
    expect(username).toHaveAttribute("aria-invalid", "true");
    expect(username).toHaveAttribute("aria-describedby", "platform-account-username-error");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("서버 실패는 전역 오류로 표시하고 모달을 유지한다", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("계정 중복"));
    const { onClose } = renderModal(onSubmit);
    fireEvent.change(screen.getByLabelText("아이디"), { target: { value: "staff" } });
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "홍길동" } });
    fireEvent.click(screen.getByRole("button", { name: "계정 발급" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("계정 중복");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("제출 Promise가 끝날 때까지 중복 요청과 모달 닫기를 막는다", async () => {
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => { resolveSubmit = resolve; }));
    const { onClose } = renderModal(onSubmit);
    fireEvent.change(screen.getByLabelText("아이디"), { target: { value: "staff" } });
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "홍길동" } });
    fireEvent.click(screen.getByRole("button", { name: "계정 발급" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const pendingButton = screen.getByRole("button", { name: "발급 중…" });
    expect(pendingButton).toBeDisabled();
    fireEvent.click(pendingButton);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => resolveSubmit());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
