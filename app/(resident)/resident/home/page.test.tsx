import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  automatch,
  confirm,
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

import ResidentHomePage from "./page";

async function arrangeLinkedHousehold() {
  await kakaoStubLogin();
  const [candidate] = await automatch();
  await confirm(candidate.occupancyId);
}

beforeEach(() => {
  logout();
  nav.push.mockClear();
  nav.replace.mockClear();
});

describe("ResidentHomePage", () => {
  it("shows the linked household and a coming-soon toast without navigating", async () => {
    await arrangeLinkedHousehold();
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

  it("cancels logout without clearing the resident session", async () => {
    await arrangeLinkedHousehold();
    const user = userEvent.setup();
    render(<ResidentHomePage />);

    await screen.findByText("그린빌라 201호");
    await user.click(screen.getAllByRole("button", { name: "로그아웃" })[0]);

    const dialog = screen.getByRole("dialog", {
      name: "로그아웃 하시겠습니까?",
    });
    await user.click(within(dialog).getByRole("button", { name: "닫기" }));

    expect(getSession()).not.toBeNull();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("confirms logout, clears the session, and returns to login", async () => {
    await arrangeLinkedHousehold();
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

    expect(getSession()).toBeNull();
    expect(nav.push).toHaveBeenCalledWith("/resident/login");
  });

  it("redirects to login when no household is linked", async () => {
    render(<ResidentHomePage />);

    await waitFor(() => {
      expect(nav.replace).toHaveBeenCalledWith("/resident/login");
    });
  });
});
