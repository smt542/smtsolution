import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
const profileHooks = vi.hoisted(() => ({
  useResidentProfile: vi.fn(),
  useSetNotifyPrefs: vi.fn(),
}));
const profileRefetch = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const resetOnboardingSession = vi.hoisted(() => vi.fn());
const withdrawMutateAsync = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/resident/me",
  useRouter: () => ({ replace: nav.replace }),
}));
vi.mock("@/hooks/reactquery/residentProfile", () => profileHooks);
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut } }),
}));
vi.mock("@/lib/resident/onboardingClient", () => ({ resetOnboardingSession }));
vi.mock("@/hooks/reactquery/residentWithdrawal", () => ({
  useWithdrawResident: () => ({
    mutateAsync: withdrawMutateAsync,
    isPending: false,
  }),
}));
vi.mock("@/app/(resident)/_components/MoveOutSection", () => ({
  default: () => <section aria-label="퇴실 신청">퇴실 신청 영역</section>,
}));
vi.mock("@/hooks/reactquery/residentMoveOut", () => ({
  useMoveOutRequest: () => ({
    data: null,
    error: null,
    isPending: false,
    refetch: vi.fn(),
  }),
}));

import ResidentMePage from "./page";

const mutate = vi.fn();
const profile = {
  tenantName: "김주민",
  kakaoName: "김주민",
  phone: "01012345678",
  buildingName: "해오름빌라",
  unitNo: "201호",
  moveInDate: "2025-03-01",
  orgId: 2,
  orgName: "해오름관리",
  transferMethod: "auto_transfer",
  billDelivery: "alimtalk",
  alimtalkOptIn: true,
  smsOptIn: false,
  linkedAt: "2026-08-19T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  profileHooks.useResidentProfile.mockReturnValue({
    data: profile,
    error: null,
    isPending: false,
    refetch: profileRefetch,
  });
  profileHooks.useSetNotifyPrefs.mockReturnValue({
    mutate,
    isPending: false,
    error: null,
  });
  signOut.mockResolvedValue({ error: null });
  withdrawMutateAsync.mockResolvedValue(undefined);
});

describe("ResidentMePage", () => {
  it("preserves profile loading, error, and retry states", async () => {
    profileHooks.useResidentProfile.mockReturnValue({
      data: undefined,
      error: null,
      isPending: true,
      refetch: profileRefetch,
    });
    const loading = render(<ResidentMePage />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "내 정보를 불러오고 있어요.",
    );
    loading.unmount();

    profileHooks.useResidentProfile.mockReturnValue({
      data: undefined,
      error: new Error("failed"),
      isPending: false,
      refetch: profileRefetch,
    });
    const user = userEvent.setup();
    render(<ResidentMePage />);
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(profileRefetch).toHaveBeenCalledOnce();
  });

  it("renders profile header, household, and policies", () => {
    render(<ResidentMePage />);
    expect(screen.getByText("김주민")).toBeInTheDocument();
    expect(screen.getByText("카카오 간편 로그인")).toBeInTheDocument();
    expect(screen.getByText("해오름관리")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "이용약관" })).toHaveAttribute("href", "/resident/terms");
    expect(screen.getByRole("link", { name: "개인정보 처리방침" })).toHaveAttribute("href", "/resident/privacy");
    expect(screen.getByLabelText("퇴실 신청")).toBeInTheDocument();
  });

  it("warns before disabling Alimtalk and saves both channels off together", async () => {
    const user = userEvent.setup();
    render(<ResidentMePage />);

    await user.click(screen.getByRole("switch", { name: "알림톡" }));
    const dialog = screen.getByRole("dialog", { name: "알림톡을 끌까요?" });
    expect(within(dialog).getByText(/알려드릴 수\s*없어요/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "그래도 끄기" }));
    expect(mutate).toHaveBeenCalledWith({ alimtalk: false, sms: false });
  });

  it("signs out, clears onboarding state, and replaces to login", async () => {
    const user = userEvent.setup();
    render(<ResidentMePage />);

    await user.click(screen.getByRole("button", { name: "로그아웃" }));
    const dialog = screen.getByRole("dialog", { name: "로그아웃할까요?" });
    await user.click(within(dialog).getByRole("button", { name: "로그아웃" }));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledOnce();
      expect(resetOnboardingSession).toHaveBeenCalledOnce();
      expect(nav.replace).toHaveBeenCalledWith("/resident/login");
    });
  });

  it("withdraws membership, signs out, clears onboarding state, and replaces to login", async () => {
    const user = userEvent.setup();
    render(<ResidentMePage />);

    await user.click(screen.getByRole("button", { name: "회원탈퇴" }));
    const dialog = screen.getByRole("dialog", { name: "정말 탈퇴할까요?" });
    await user.click(within(dialog).getByRole("button", { name: "탈퇴하기" }));

    await waitFor(() => {
      expect(withdrawMutateAsync).toHaveBeenCalledOnce();
      expect(signOut).toHaveBeenCalledOnce();
      expect(resetOnboardingSession).toHaveBeenCalledOnce();
      expect(nav.replace).toHaveBeenCalledWith("/resident/login");
    });
  });

  it("keeps the resident on the page and shows an error when withdrawal fails", async () => {
    withdrawMutateAsync.mockRejectedValueOnce(new Error("탈퇴에 실패했어요"));
    const user = userEvent.setup();
    render(<ResidentMePage />);

    await user.click(screen.getByRole("button", { name: "회원탈퇴" }));
    const dialog = screen.getByRole("dialog", { name: "정말 탈퇴할까요?" });
    await user.click(within(dialog).getByRole("button", { name: "탈퇴하기" }));

    await waitFor(() =>
      expect(within(dialog).getByText("탈퇴에 실패했어요")).toBeInTheDocument(),
    );
    expect(signOut).not.toHaveBeenCalled();
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
