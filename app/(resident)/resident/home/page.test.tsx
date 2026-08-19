import { render, screen, waitFor, within } from "@testing-library/react";
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
import type { MyLink } from "@/lib/resident/onboardingClient";

import ResidentHomePage from "./page";

const link: MyLink = {
  buildingName: "그린빌라",
  unitNo: "201호",
  tenantName: "박정호",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(client.myLink).mockResolvedValue(link);
  vi.mocked(client.logout).mockResolvedValue(undefined);
});

describe("ResidentHomePage", () => {
  it("shows the linked household and a coming-soon toast without navigating", async () => {
    const user = userEvent.setup();
    render(<ResidentHomePage />);

    expect(await screen.findByText("그린빌라 201호")).toBeInTheDocument();
    expect(screen.getByText("박정호 님")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /관리비 확인/ }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "관리비 확인 화면은 준비 중이에요",
    );
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("cancels the logout modal without signing out", async () => {
    const user = userEvent.setup();
    render(<ResidentHomePage />);

    await screen.findByText("그린빌라 201호");
    await user.click(screen.getAllByRole("button", { name: "로그아웃" })[0]);

    const dialog = screen.getByRole("dialog", {
      name: "로그아웃 하시겠습니까?",
    });
    const openClassName = dialog.className;
    await user.click(within(dialog).getByRole("button", { name: "닫기" }));

    expect(client.logout).not.toHaveBeenCalled();
    expect(nav.push).not.toHaveBeenCalled();
    expect(dialog.className).not.toBe(openClassName);
  });

  it("awaits logout confirmation and returns to login", async () => {
    const user = userEvent.setup();
    render(<ResidentHomePage />);

    await screen.findByText("그린빌라 201호");
    await user.click(screen.getAllByRole("button", { name: "로그아웃" })[0]);

    const dialog = screen.getByRole("dialog", {
      name: "로그아웃 하시겠습니까?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "로그아웃" }),
    );

    await waitFor(() => {
      expect(client.logout).toHaveBeenCalledOnce();
      expect(nav.push).toHaveBeenCalledWith("/resident/login");
    });
  });

  it("redirects to login when no household is linked", async () => {
    vi.mocked(client.myLink).mockResolvedValue(null);
    render(<ResidentHomePage />);

    await waitFor(() => {
      expect(nav.replace).toHaveBeenCalledWith("/resident/login");
    });
  });
});
