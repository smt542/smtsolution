import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/resident/onboardingClient", () => ({
  kakaoStubLogin: vi.fn().mockResolvedValue({ ok: true }),
  automatch: vi.fn(),
  getActiveCandidate: vi.fn(),
  getSession: vi.fn(),
  confirm: vi.fn().mockResolvedValue({ status: "linked" }),
  requestClaim: vi.fn().mockResolvedValue({ status: "pending" }),
  searchBuildings: vi.fn().mockResolvedValue([]),
  myLink: vi.fn(),
  getPendingInfo: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
}));

import * as client from "@/lib/resident/onboardingClient";

import ResidentLoginPage from "./page";

const originalKakaoLoginFlag = process.env.NEXT_PUBLIC_KAKAO_LOGIN_ENABLED;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_KAKAO_LOGIN_ENABLED;
  vi.mocked(client.kakaoStubLogin).mockResolvedValue({ ok: true });
});

afterAll(() => {
  if (originalKakaoLoginFlag === undefined) {
    delete process.env.NEXT_PUBLIC_KAKAO_LOGIN_ENABLED;
  } else {
    process.env.NEXT_PUBLIC_KAKAO_LOGIN_ENABLED = originalKakaoLoginFlag;
  }
});

describe("ResidentLoginPage", () => {
  it("opens the Kakao sheet and continues through the server-decided flow", async () => {
    const user = userEvent.setup();
    render(<ResidentLoginPage />);

    await user.click(
      screen.getByRole("button", { name: "카카오톡으로 3초 만에 시작" }),
    );

    expect(screen.getByText("카카오 로그인으로 연결할까요?")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "테스트: 세대 정보 없음으로 진행",
      }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "계속하기" }));

    await waitFor(() => {
      expect(client.kakaoStubLogin).toHaveBeenCalledOnce();
      expect(nav.push).toHaveBeenCalledWith("/resident/auth");
    });
  });

  it("uses a full-page OAuth link when real Kakao login is enabled", () => {
    process.env.NEXT_PUBLIC_KAKAO_LOGIN_ENABLED = "true";
    render(<ResidentLoginPage />);

    expect(
      screen.getByRole("link", { name: "카카오톡으로 3초 만에 시작" }),
    ).toHaveAttribute("href", "/api/resident/kakao/login");
    expect(client.kakaoStubLogin).not.toHaveBeenCalled();
  });
});
