import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  automatch,
  getSession,
  logout,
} from "@/lib/resident/onboardingClient";

const nav = vi.hoisted(() => {
  const push = vi.fn();
  const replace = vi.fn();

  return {
    push,
    replace,
    router: { push, replace, back: vi.fn(), prefetch: vi.fn() },
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => nav.router }));

import ResidentLoginPage from "./page";

beforeEach(() => {
  logout();
  nav.push.mockClear();
  nav.replace.mockClear();
});

describe("ResidentLoginPage", () => {
  it("renders the hero and opens the Kakao login sheet", async () => {
    const user = userEvent.setup();
    render(<ResidentLoginPage />);

    expect(
      screen.getByRole("heading", { name: /이번 달 관리비/ }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "카카오톡으로 3초 만에 시작" }),
    );

    expect(screen.getByText("카카오 로그인으로 연결할까요?")).toBeInTheDocument();
  });

  it("continues with a matched session", async () => {
    const user = userEvent.setup();
    render(<ResidentLoginPage />);

    await user.click(
      screen.getByRole("button", { name: "카카오톡으로 3초 만에 시작" }),
    );
    await user.click(screen.getByRole("button", { name: "계속하기" }));

    await waitFor(() => {
      expect(nav.push).toHaveBeenCalledWith("/resident/auth");
    });
    expect(getSession()).not.toBeNull();
    await expect(automatch()).resolves.toHaveLength(1);
  });

  it("continues with an unmatched test session", async () => {
    const user = userEvent.setup();
    render(<ResidentLoginPage />);

    await user.click(
      screen.getByRole("button", { name: "카카오톡으로 3초 만에 시작" }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "테스트: 세대 정보 없음으로 진행",
      }),
    );

    await waitFor(() => {
      expect(nav.push).toHaveBeenCalledWith("/resident/auth");
    });
    await expect(automatch()).resolves.toEqual([]);
  });
});
