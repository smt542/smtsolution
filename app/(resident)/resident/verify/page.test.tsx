import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  automatch,
  getActiveCandidate,
  getPendingInfo,
  kakaoStubLogin,
  logout,
  myLink,
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

import ResidentVerifyPage from "./page";

beforeEach(async () => {
  logout();
  nav.push.mockClear();
  nav.replace.mockClear();
  await kakaoStubLogin();
  await automatch();
});

describe("ResidentVerifyPage", () => {
  it("renders the matched candidate household card", async () => {
    const candidate = getActiveCandidate();
    if (!candidate) throw new Error("Expected the seeded matched candidate");

    render(<ResidentVerifyPage />);

    expect(await screen.findByText(candidate.buildingName)).toBeInTheDocument();
    expect(screen.getByText(candidate.unitNo)).toBeInTheDocument();
    expect(
      screen.getByText(`${candidate.tenantNameMasked} 님`),
    ).toBeInTheDocument();
    expect(screen.getByText(candidate.phoneMasked)).toBeInTheDocument();
  });

  it("confirms the candidate and continues to notification setup", async () => {
    const user = userEvent.setup();
    render(<ResidentVerifyPage />);

    await user.click(
      await screen.findByRole("button", { name: "네, 맞아요" }),
    );

    await waitFor(() => {
      expect(nav.push).toHaveBeenCalledWith("/resident/notify");
    });
    await expect(myLink()).resolves.not.toBeNull();
  });

  it("requests a claim for a selected building and unit", async () => {
    const user = userEvent.setup();
    render(<ResidentVerifyPage />);

    await user.click(
      await screen.findByRole("button", { name: "제 세대가 아니에요" }),
    );
    expect(screen.getByText("어느 건물에 사시나요?")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText("예: 그린빌라 · 봉명동");
    await user.type(searchInput, "그린");

    expect(await screen.findByText("1개 건물")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /그린빌라/ }),
    );

    expect(screen.getByText("호수를 입력해 주세요")).toBeInTheDocument();
    const submitButton = screen.getByRole("button", { name: "확인 요청하기" });
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText("호수 입력 (예: 201)"), "201");
    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    await waitFor(() => {
      expect(nav.push).toHaveBeenCalledWith("/resident/pending");
    });
    expect(getPendingInfo()).toMatchObject({
      buildingName: "그린빌라",
      unitNo: "201호",
    });
  });

  it("requests a search claim from the empty building state", async () => {
    const user = userEvent.setup();
    render(<ResidentVerifyPage />);

    await user.click(
      await screen.findByRole("button", { name: "제 세대가 아니에요" }),
    );
    const searchInput = screen.getByPlaceholderText("예: 그린빌라 · 봉명동");
    await user.type(searchInput, "검색되지않는건물");

    expect(await screen.findByText("검색 결과가 없어요")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "관리사무소에 확인 요청" }),
    );

    await waitFor(() => {
      expect(nav.push).toHaveBeenCalledWith("/resident/pending");
    });
    expect(getPendingInfo()).toMatchObject({ buildingName: "", unitNo: "" });
  });
});
