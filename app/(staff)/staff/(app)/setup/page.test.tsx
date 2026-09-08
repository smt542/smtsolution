// app/(staff)/staff/setup/page.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getMock = vi.fn<(k: string) => string | null>(() => null);
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: getMock }),
  useRouter: () => ({ replace: replaceMock }),
}));
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("./components/BillingSettingsTab", () => ({ BillingSettingsTab: () => <div>TAB_BILLING</div> }));
vi.mock("./components/AccountSettingsTab", () => ({ AccountSettingsTab: () => <div>TAB_ACCOUNTS</div> }));
vi.mock("./components/MovingSettlementSettingsTab", () => ({ MovingSettlementSettingsTab: () => <div>TAB_SETTLEMENT</div> }));
vi.mock("./components/SystemSettingsTab", () => ({ SystemSettingsTab: () => <div>TAB_SYSTEM</div> }));

import SetupPage from "./page";
import { useMe } from "@/hooks/reactquery/auth";

beforeEach(() => { vi.clearAllMocks(); getMock.mockReturnValue(null); });

describe("SetupPage", () => {
  it("settings 권한 없으면 접근 차단", () => {
    vi.mocked(useMe).mockReturnValue({ data: { role: "staff", permissions: [] } } as unknown as ReturnType<typeof useMe>);
    render(<SetupPage />);
    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText("TAB_BILLING")).toBeNull();
  });

  it("settings 권한 있으면 탭 렌더 + 기본 고지서 탭", async () => {
    vi.mocked(useMe).mockReturnValue({ data: { role: "staff", permissions: ["settings"] } } as unknown as ReturnType<typeof useMe>);
    render(<SetupPage />);
    expect(screen.getByRole("button", { name: "고지서 설정" })).toBeInTheDocument();
    expect(await screen.findByText("TAB_BILLING")).toBeInTheDocument();
  });

  it("마스터(org_owner)는 권한 배열 없어도 통과", async () => {
    vi.mocked(useMe).mockReturnValue({ data: { role: "org_owner", permissions: [] } } as unknown as ReturnType<typeof useMe>);
    render(<SetupPage />);
    expect(await screen.findByText("TAB_BILLING")).toBeInTheDocument();
  });

  it("?tab=system 이면 시스템 탭으로 시작", async () => {
    getMock.mockReturnValue("system");
    vi.mocked(useMe).mockReturnValue({ data: { role: "org_owner", permissions: [] } } as unknown as ReturnType<typeof useMe>);
    render(<SetupPage />);
    expect(await screen.findByText("TAB_SYSTEM")).toBeInTheDocument();
  });

  it("탭 클릭 시 전환", async () => {
    vi.mocked(useMe).mockReturnValue({ data: { role: "org_owner", permissions: [] } } as unknown as ReturnType<typeof useMe>);
    render(<SetupPage />);
    fireEvent.click(screen.getByRole("button", { name: "시스템 설정" }));
    expect(await screen.findByText("TAB_SYSTEM")).toBeInTheDocument();
  });

  it("기존 ?tab=repair 링크는 독립 장기수선비 화면으로 전환", () => {
    getMock.mockReturnValue("repair");
    vi.mocked(useMe).mockReturnValue({ data: { role: "org_owner", permissions: [] } } as unknown as ReturnType<typeof useMe>);

    render(<SetupPage />);

    expect(replaceMock).toHaveBeenCalledWith("/staff/long-term-repair");
    expect(screen.queryByText("TAB_BILLING")).toBeNull();
  });
});
