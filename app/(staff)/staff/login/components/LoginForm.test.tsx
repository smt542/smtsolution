import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const mutateAsync = vi.fn();
vi.mock("@/hooks/reactquery/auth", () => ({ useLogin: () => ({ mutateAsync, isPending: false }) }));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

import { LoginForm } from "./LoginForm";

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe("LoginForm", () => {
  it("빈 제출 시 검증 메시지", async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(await screen.findByText("아이디를 입력해 주세요")).toBeInTheDocument();
  });

  it("정상 입력 → mutateAsync 호출 후 이동", async () => {
    mutateAsync.mockResolvedValue({});
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("아이디"), "hong");
    await userEvent.type(screen.getByLabelText("비밀번호"), "pw123456");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(mutateAsync).toHaveBeenCalledWith({ username: "hong", password: "pw123456", autoLogin: false });
    expect(push).toHaveBeenCalledWith("/staff/receipt-management");
  });

  it("로그인 실패 시 에러 배너", async () => {
    mutateAsync.mockRejectedValue(new Error("아이디 또는 비밀번호가 올바르지 않습니다."));
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("아이디"), "hong");
    await userEvent.type(screen.getByLabelText("비밀번호"), "bad");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(await screen.findByText("아이디 또는 비밀번호가 올바르지 않습니다.")).toBeInTheDocument();
  });

  it("자동로그인 체크 시 localStorage에 '1' 저장", async () => {
    mutateAsync.mockResolvedValue({});
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("아이디"), "hong");
    await userEvent.type(screen.getByLabelText("비밀번호"), "pw123456");
    await userEvent.click(screen.getByLabelText("자동 로그인"));
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(localStorage.getItem("erp_login_auto")).toBe("1");
  });

  it("자동로그인 미체크면 플래그 미저장", async () => {
    mutateAsync.mockResolvedValue({});
    localStorage.setItem("erp_login_auto", "1");
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("아이디"), "hong");
    await userEvent.type(screen.getByLabelText("비밀번호"), "pw123456");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(localStorage.getItem("erp_login_auto")).toBeNull();
  });

  it("mustChangePassword면 안내 토스트", async () => {
    const { toast } = await import("sonner");
    mutateAsync.mockResolvedValue({ mustChangePassword: true });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("아이디"), "hong");
    await userEvent.type(screen.getByLabelText("비밀번호"), "pw123456");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect((toast.info as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });
});
