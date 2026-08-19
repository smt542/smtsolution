import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEMO_UNMATCHED_IDENTITY,
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

import ResidentAuthPage from "./page";

beforeEach(() => {
  logout();
  nav.push.mockClear();
  nav.replace.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ResidentAuthPage", () => {
  it("redirects to login without a session", () => {
    render(<ResidentAuthPage />);

    expect(nav.replace).toHaveBeenCalledWith("/resident/login");
  });

  it("routes a matched session to household verification", async () => {
    await kakaoStubLogin();
    render(<ResidentAuthPage />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(nav.replace).toHaveBeenCalledWith("/resident/verify");
  });

  it("routes an unmatched session to the no-match screen", async () => {
    await kakaoStubLogin(DEMO_UNMATCHED_IDENTITY);
    render(<ResidentAuthPage />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(nav.replace).toHaveBeenCalledWith("/resident/nomatch");
  });
});
