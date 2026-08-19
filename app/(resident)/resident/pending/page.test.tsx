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
  confirm: vi.fn().mockResolvedValue({ status: "linked" }),
  requestClaim: vi.fn().mockResolvedValue({ status: "pending" }),
  searchBuildings: vi.fn().mockResolvedValue([]),
  myLink: vi.fn(),
  getPendingInfo: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
}));

import * as client from "@/lib/resident/onboardingClient";
import type { PendingInfo } from "@/lib/resident/onboardingClient";

import ResidentPendingPage from "./page";

const pendingInfo: PendingInfo = {
  buildingName: "그린빌라",
  unitNo: "201호",
  requestedAt: "2026-08-19T12:34:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(client.getPendingInfo).mockReturnValue(pendingInfo);
});

describe("ResidentPendingPage", () => {
  it("shows the request without org contact or mock approval actions", async () => {
    const user = userEvent.setup();
    render(<ResidentPendingPage />);

    expect(await screen.findByText("그린빌라 201호")).toBeInTheDocument();
    expect(screen.getByText("2026.08.19 12:34")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "전화" })).not.toBeInTheDocument();
    expect(screen.queryByText(/승인되었다고 가정/)).not.toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    await user.click(
      screen.getByRole("button", { name: "로그인 화면으로" }),
    );

    expect(nav.push).toHaveBeenCalledWith("/resident/login");
  });

  it("redirects to login when there is no pending request", async () => {
    vi.mocked(client.getPendingInfo).mockReturnValue(null);
    render(<ResidentPendingPage />);

    await waitFor(() => {
      expect(nav.replace).toHaveBeenCalledWith("/resident/login");
    });
  });
});
