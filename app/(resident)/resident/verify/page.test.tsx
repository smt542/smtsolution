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
import type {
  Building,
  Candidate,
  KakaoIdentity,
} from "@/lib/resident/onboardingClient";

import ResidentVerifyPage from "./page";

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
};

const building: Building = {
  id: 9,
  name: "푸른아파트",
  address: "대전 유성구 봉명동 10",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(client.getSession).mockReturnValue({ identity });
  vi.mocked(client.loadSession).mockResolvedValue({ identity });
  vi.mocked(client.getActiveCandidate).mockReturnValue(candidate);
  vi.mocked(client.automatch).mockResolvedValue([candidate]);
  vi.mocked(client.confirm).mockResolvedValue({ status: "linked" });
  vi.mocked(client.requestClaim).mockResolvedValue({ status: "pending" });
  vi.mocked(client.searchBuildings).mockResolvedValue([building]);
});

describe("ResidentVerifyPage", () => {
  it("shows the lean household card and confirms its occupancy", async () => {
    const user = userEvent.setup();
    render(<ResidentVerifyPage />);

    expect(await screen.findByText("그린빌라")).toBeInTheDocument();
    expect(screen.getByText("201호")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "네, 맞아요" }));

    await waitFor(() => {
      expect(client.confirm).toHaveBeenCalledWith(123);
      expect(nav.push).toHaveBeenCalledWith("/resident/notify");
    });
  });

  it("requests a claim for a selected building and numeric unit", async () => {
    const user = userEvent.setup();
    render(<ResidentVerifyPage />);

    await user.click(
      await screen.findByRole("button", { name: "제 세대가 아니에요" }),
    );
    const searchInput = screen.getByPlaceholderText("예: 그린빌라 · 봉명동");
    await user.type(searchInput, "푸른");

    expect(await screen.findByText("1개 건물")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /푸른아파트/ }));

    expect(screen.getByText("호수를 입력해 주세요")).toBeInTheDocument();
    const submitButton = screen.getByRole("button", { name: "확인 요청하기" });
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText("호수 입력 (예: 201)"), "302");
    await user.click(submitButton);

    await waitFor(() => {
      expect(client.requestClaim).toHaveBeenCalledWith({
        buildingId: 9,
        unitText: "302",
        buildingName: "푸른아파트",
      });
      expect(nav.push).toHaveBeenCalledWith("/resident/pending");
    });
  });

  it("shows a no-results message without an office-request action", async () => {
    vi.mocked(client.searchBuildings).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<ResidentVerifyPage />);

    await user.click(
      await screen.findByRole("button", { name: "제 세대가 아니에요" }),
    );
    await user.type(
      screen.getByPlaceholderText("예: 그린빌라 · 봉명동"),
      "없는건물",
    );

    expect(await screen.findByText("검색 결과가 없어요")).toBeInTheDocument();
    expect(
      screen.getByText(/건물명이 정확하지 않아도 괜찮아요/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "관리사무소에 확인 요청" }),
    ).not.toBeInTheDocument();
  });
});
