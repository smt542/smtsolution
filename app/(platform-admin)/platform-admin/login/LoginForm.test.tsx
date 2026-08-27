import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTO_LOGIN_KEY } from "@/lib/auth/sessionPersistence";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  fetch: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess } }));

import { LoginForm } from "./LoginForm";

function renderForm() {
  render(<LoginForm />);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.stubGlobal("fetch", mocks.fetch);
});

describe("HQ LoginForm", () => {
  it("아이디로 로그인하면 성공 토스트를 표시하고 HQ 홈으로 이동한다", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ userId: "admin-1" }), { status: 200 }));
    renderForm();

    await user.type(screen.getByLabelText("아이디"), " HQ.Admin ");
    await user.type(screen.getByLabelText("비밀번호"), "secret");
    await user.click(screen.getByRole("checkbox", { name: "자동 로그인" }));
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(mocks.fetch).toHaveBeenCalledWith("/api/platform/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "HQ.Admin", password: "secret" }),
    });
    expect(localStorage.getItem(AUTO_LOGIN_KEY)).toBe("1");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("로그인되었습니다");
    expect(mocks.push).toHaveBeenCalledWith("/platform-admin");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("잘못된 자격 증명이면 서버의 오류 메시지를 표시한다", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockResolvedValue(new Response(
      JSON.stringify({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    ));
    renderForm();

    await user.type(screen.getByLabelText("아이디"), "not-admin");
    await user.type(screen.getByLabelText("비밀번호"), "wrong");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("아이디 또는 비밀번호가 올바르지 않습니다.");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("아이디나 비밀번호가 없으면 제출할 수 없다", async () => {
    const user = userEvent.setup();
    renderForm();

    const usernameInput = screen.getByLabelText("아이디");
    const submitButton = screen.getByRole("button", { name: "로그인" });
    expect(usernameInput).toHaveAttribute("type", "text");
    expect(usernameInput).toHaveAttribute("autocomplete", "username");
    expect(usernameInput).toHaveAttribute("placeholder", "아이디를 입력해 주세요");
    expect(submitButton).toBeDisabled();

    await user.type(usernameInput, "hq");
    expect(submitButton).toBeDisabled();

    await user.clear(usernameInput);
    await user.type(screen.getByLabelText("비밀번호"), "secret");
    expect(submitButton).toBeDisabled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
