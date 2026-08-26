import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  mutateAsync: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/platform-admin",
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/hooks/reactquery/auth", () => ({
  useMe: () => ({
    data: {
      role: "platform_admin",
      username: "hq",
      fullName: "본사 관리자",
    },
  }),
  useLogout: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
  }),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

import { PlatformShell } from "./PlatformShell";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mutateAsync.mockResolvedValue(undefined);
});

describe("PlatformShell", () => {
  it("프로필 메뉴에서 실제 로그아웃 후 HQ 로그인 화면으로 이동한다", async () => {
    const user = userEvent.setup();
    render(<PlatformShell><div>콘텐츠</div></PlatformShell>);

    await user.click(screen.getByLabelText("프로필 메뉴"));
    await user.click(screen.getByRole("button", { name: "로그아웃" }));

    expect(mocks.mutateAsync).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenCalledWith("/platform-admin/login");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
