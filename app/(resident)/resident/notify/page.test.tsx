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

import ResidentNotifyPage from "./page";

beforeEach(() => {
  nav.push.mockClear();
  nav.replace.mockClear();
});

describe("ResidentNotifyPage", () => {
  it("starts with alerts enabled and supports forward and back navigation", async () => {
    const user = userEvent.setup();
    render(<ResidentNotifyPage />);

    expect(
      screen.getByRole("switch", { name: "알림톡 받기" }),
    ).toBeChecked();

    await user.click(screen.getByRole("button", { name: "시작하기" }));
    expect(nav.push).toHaveBeenCalledWith("/resident/home");

    await user.click(screen.getByRole("button", { name: "이전 화면" }));
    expect(nav.push).toHaveBeenCalledWith("/resident/verify");
  });
});
