import { render, screen } from "@testing-library/react";
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

import ResidentNotifyPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ResidentNotifyPage", () => {
  it("keeps the local toggle and supports forward and back navigation", async () => {
    const user = userEvent.setup();
    render(<ResidentNotifyPage />);

    const notificationSwitch = screen.getByRole("switch", {
      name: "알림톡 받기",
    });
    expect(notificationSwitch).toBeChecked();

    await user.click(notificationSwitch);
    expect(notificationSwitch).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "시작하기" }));
    expect(nav.push).toHaveBeenCalledWith("/resident/home");

    await user.click(screen.getByRole("button", { name: "이전 화면" }));
    expect(nav.push).toHaveBeenCalledWith("/resident/verify");
  });
});
