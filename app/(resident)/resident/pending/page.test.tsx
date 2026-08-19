import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  kakaoStubLogin,
  logout,
  myLink,
  requestClaim,
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

import ResidentPendingPage from "./page";

async function arrangePendingClaim() {
  await kakaoStubLogin();
  await requestClaim({
    buildingId: "bld_greenvilla",
    unitText: "201",
    kind: "unit",
  });
}

beforeEach(() => {
  logout();
  nav.push.mockClear();
  nav.replace.mockClear();
});

describe("ResidentPendingPage", () => {
  it("shows the requested household and returns to login", async () => {
    await arrangePendingClaim();
    const user = userEvent.setup();
    render(<ResidentPendingPage />);

    expect(await screen.findByText("그린빌라 201호")).toBeInTheDocument();
    expect(screen.getByText(/042-822-4410/)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "로그인 화면으로" }),
    );

    expect(nav.push).toHaveBeenCalledWith("/resident/login");
  });

  it("approves the pending claim and opens the resident home", async () => {
    await arrangePendingClaim();
    const user = userEvent.setup();
    render(<ResidentPendingPage />);

    await user.click(
      await screen.findByRole("button", {
        name: "테스트: 승인되었다고 가정하고 홈으로",
      }),
    );

    await waitFor(() => {
      expect(nav.push).toHaveBeenCalledWith("/resident/home");
    });
    await expect(myLink()).resolves.not.toBeNull();
  });

  it("redirects to login when there is no pending claim", () => {
    render(<ResidentPendingPage />);

    expect(nav.replace).toHaveBeenCalledWith("/resident/login");
  });
});
