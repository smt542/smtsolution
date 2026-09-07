import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import type { Candidate, KakaoIdentity } from "@/lib/resident/onboardingClient";

import ResidentAuthPage from "./page";

const identity: KakaoIdentity = {
  kakaoId: "kakao-7788",
  name: "박정호",
  phone: "010-2000-7788",
};

const candidate: Candidate = {
  occupancyId: 123,
  buildingId: 5,
  buildingName: "그린빌라",
  unitNo: "201호",
  orgId: 7,
  kakaoName: "박정호",
  tenantNameMasked: "박O호",
  phoneMasked: "010-****-7788",
  moveInDate: "2024-03-02",
  orgName: "테스트 관리회사",
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.mocked(client.getSession).mockReturnValue(null);
  vi.mocked(client.loadSession).mockResolvedValue(null);
  vi.mocked(client.automatch).mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ResidentAuthPage", () => {
  it("redirects to login without a session", async () => {
    render(<ResidentAuthPage />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(nav.replace).toHaveBeenCalledWith("/resident/login");
    expect(client.automatch).not.toHaveBeenCalled();
  });

  it("routes a matched session to household verification", async () => {
    vi.mocked(client.getSession).mockReturnValue({ identity });
    vi.mocked(client.loadSession).mockResolvedValue({ identity });
    vi.mocked(client.automatch).mockResolvedValue([candidate]);
    render(<ResidentAuthPage />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(client.automatch).toHaveBeenCalledOnce();
    expect(nav.replace).toHaveBeenCalledWith("/resident/verify");
  });

  it("routes an unmatched session to the no-match screen", async () => {
    vi.mocked(client.getSession).mockReturnValue({ identity });
    vi.mocked(client.loadSession).mockResolvedValue({ identity });
    vi.mocked(client.automatch).mockResolvedValue([]);
    render(<ResidentAuthPage />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(nav.replace).toHaveBeenCalledWith("/resident/nomatch");
  });
});
