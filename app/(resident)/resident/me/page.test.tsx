import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
const guard = vi.hoisted(() => ({ useResidentGuard: vi.fn() }));
const profileHooks = vi.hoisted(() => ({
  useResidentProfile: vi.fn(),
  useSetNotifyPrefs: vi.fn(),
}));
const signOut = vi.hoisted(() => vi.fn());
const resetOnboardingSession = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/resident/me",
  useRouter: () => ({ replace: nav.replace }),
}));
vi.mock("@/lib/resident/useResidentGuard", () => guard);
vi.mock("@/hooks/reactquery/residentProfile", () => profileHooks);
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut } }),
}));
vi.mock("@/lib/resident/onboardingClient", () => ({ resetOnboardingSession }));
vi.mock("@/app/(resident)/_components/MoveOutSection", () => ({
  default: () => <section aria-label="퇴실 신청">퇴실 신청 영역</section>,
}));

import ResidentMePage from "./page";

const mutate = vi.fn();
const profile = {
  tenantName: "김주민",
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
  guard.useResidentGuard.mockReturnValue({
    loading: false,
    link: { buildingName: "해오름빌라", unitNo: "201호" },
    error: null,
    retry: vi.fn(),
  });
  profileHooks.useResidentProfile.mockReturnValue({
    data: profile,
    error: null,
    isPending: false,
    refetch: vi.fn(),
  });
  profileHooks.useSetNotifyPrefs.mockReturnValue({
    mutate,
    isPending: false,
    error: null,
  });
  signOut.mockResolvedValue({ error: null });
});

describe("ResidentMePage", () => {
  it("renders profile, household, policies, and auto-transfer marker", () => {
    render(<ResidentMePage />);
    expect(screen.getByText("김주민")).toBeInTheDocument();
    expect(screen.getByText("카카오 간편로그인")).toBeInTheDocument();
    expect(screen.getByText("자동이체 세대")).toBeInTheDocument();
    expect(screen.getByText("해오름관리")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "이용약관" })).toHaveAttribute("href", "/resident/terms");
    expect(screen.getByRole("link", { name: "개인정보 처리방침" })).toHaveAttribute("href", "/resident/privacy");
    expect(screen.getByLabelText("퇴실 신청")).toBeInTheDocument();
  });

  it("warns before disabling Alimtalk and saves both toggle types", async () => {
    const user = userEvent.setup();
    render(<ResidentMePage />);

    await user.click(screen.getByRole("switch", { name: "카카오 알림톡" }));
    const dialog = screen.getByRole("dialog", { name: "카카오 알림톡을 끌까요?" });
    expect(within(dialog).getByText("관리비 확정 안내를 못 받을 수 있어요.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "끄기" }));
    expect(mutate).toHaveBeenCalledWith({ alimtalk: false });

    await user.click(screen.getByRole("switch", { name: "문자" }));
    expect(mutate).toHaveBeenCalledWith({ sms: true });
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
});
