import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  loadSession: vi.fn(),
  confirm: vi.fn().mockResolvedValue({ status: "linked" }),
  requestClaim: vi.fn().mockResolvedValue({ status: "pending" }),
  searchBuildings: vi.fn().mockResolvedValue([]),
  myLink: vi.fn(),
  getPendingInfo: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
}));

import * as client from "@/lib/resident/onboardingClient";
import type { KakaoIdentity } from "@/lib/resident/onboardingClient";

import ResidentNomatchPage from "./page";

const identity: KakaoIdentity = {
  kakaoId: "kakao-new",
  name: "김세입",
  phone: "010-8842-1150",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(client.getSession).mockReturnValue({ identity });
  vi.mocked(client.loadSession).mockResolvedValue({ identity });
  vi.mocked(client.logout).mockResolvedValue(undefined);
});

describe("ResidentNomatchPage", () => {
  it("shows a masked phone and awaits logout before retrying", async () => {
    const user = userEvent.setup();
    render(<ResidentNomatchPage />);

    expect(await screen.findByText("010-****-1150")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "다른 카카오 계정으로 로그인" }),
    );

    await waitFor(() => {
      expect(client.logout).toHaveBeenCalledOnce();
      expect(nav.push).toHaveBeenCalledWith("/resident/login");
    });
  });
});
