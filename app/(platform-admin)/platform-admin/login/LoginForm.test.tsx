import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTO_LOGIN_KEY } from "@/lib/auth/sessionPersistence";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getMyContext: vi.fn(),
  recordLogin: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
    },
  }),
}));
vi.mock("@/hooks/reactquery/auth", () => ({
  authKeys: { me: () => ["auth", "me"] },
  getMyContext: mocks.getMyContext,
  recordLogin: mocks.recordLogin,
}));

import { LoginForm } from "./LoginForm";

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <LoginForm />
    </QueryClientProvider>,
  );
  return queryClient;
}

const platformContext = {
  orgId: 1,
  role: "platform_admin",
  orgStatus: "active",
  username: "hq",
  fullName: "본사 관리자",
  isActive: true,
  mustChangePassword: false,
  staffType: "manager_staff",
  permissions: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.signInWithPassword.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.recordLogin.mockResolvedValue(undefined);
});

describe("HQ LoginForm", () => {
  it("이메일로 로그인하고 platform_admin이면 HQ 홈으로 이동한다", async () => {
    const user = userEvent.setup();
    mocks.getMyContext.mockResolvedValue(platformContext);
    const queryClient = renderForm();

    await user.type(screen.getByLabelText("아이디"), "hq@example.com");
    await user.type(screen.getByLabelText("비밀번호"), "secret");
    await user.click(screen.getByRole("checkbox", { name: "자동 로그인" }));
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "hq@example.com",
      password: "secret",
    });
    expect(mocks.recordLogin).toHaveBeenCalled();
    expect(queryClient.getQueryData(["auth", "me"])).toEqual(platformContext);
    expect(localStorage.getItem(AUTO_LOGIN_KEY)).toBe("1");
    expect(mocks.push).toHaveBeenCalledWith("/platform-admin");
  });

  it("platform_admin이 아니면 로그아웃하고 전용 콘솔 오류를 표시한다", async () => {
    const user = userEvent.setup();
    mocks.getMyContext.mockResolvedValue({ ...platformContext, role: "org_owner" });
    renderForm();

    await user.type(screen.getByLabelText("아이디"), "owner@example.com");
    await user.type(screen.getByLabelText("비밀번호"), "secret");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(await screen.findByRole("alert")).toHaveTextContent("본사 관리자 전용 콘솔입니다");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
