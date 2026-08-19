import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEMO_UNMATCHED_IDENTITY,
  getSession,
  kakaoStubLogin,
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

import ResidentNomatchPage from "./page";

beforeEach(async () => {
  logout();
  nav.push.mockClear();
  nav.replace.mockClear();
  await kakaoStubLogin(DEMO_UNMATCHED_IDENTITY);
});

describe("ResidentNomatchPage", () => {
  it("explains no-match reasons and retries with a cleared session", async () => {
    const user = userEvent.setup();
    render(<ResidentNomatchPage />);

    expect(
      await screen.findByText("010-****-1150"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("관리사무소에 등록된 번호가 다를 수 있어요"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("입주 등록이 아직 안 됐을 수 있어요"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("세대주 명의가 가족일 수 있어요"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "다른 카카오 계정으로 로그인" }),
    );

    await waitFor(() => {
      expect(nav.push).toHaveBeenCalledWith("/resident/login");
    });
    expect(getSession()).toBeNull();
  });
});
