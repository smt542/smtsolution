import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStaffContext: vi.fn(),
  redirect: vi.fn(),
  setupTabs: vi.fn(),
}));

vi.mock("../_staffContext", () => ({
  getStaffContext: mocks.getStaffContext,
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
vi.mock("./SetupTabs", () => ({
  SetupTabs: ({ initialTab }: { initialTab: string }) => {
    mocks.setupTabs(initialTab);
    return <div>SETUP_TABS_{initialTab}</div>;
  },
}));

import SetupPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStaffContext.mockResolvedValue({
    role: "staff",
    permissions: ["settings"],
  });
});

describe("SetupPage", () => {
  it("settings 권한 없으면 서버에서 접근을 차단한다", async () => {
    mocks.getStaffContext.mockResolvedValue({ role: "staff", permissions: [] });

    render(await SetupPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
    expect(mocks.setupTabs).not.toHaveBeenCalled();
  });

  it("settings 권한이 있으면 기본 고지서 탭을 전달한다", async () => {
    render(await SetupPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("SETUP_TABS_billing")).toBeInTheDocument();
    expect(mocks.setupTabs).toHaveBeenCalledWith("billing");
  });

  it("마스터는 권한 배열 없이도 통과한다", async () => {
    mocks.getStaffContext.mockResolvedValue({
      role: "org_owner",
      permissions: [],
    });

    render(await SetupPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("SETUP_TABS_billing")).toBeInTheDocument();
  });

  it("tab 쿼리의 첫 값을 초기 탭으로 전달한다", async () => {
    render(
      await SetupPage({
        searchParams: Promise.resolve({ tab: ["system", "company"] }),
      }),
    );

    expect(screen.getByText("SETUP_TABS_system")).toBeInTheDocument();
  });

  it("알 수 없는 tab 쿼리는 기본 고지서 탭으로 처리한다", async () => {
    render(
      await SetupPage({ searchParams: Promise.resolve({ tab: "unknown" }) }),
    );

    expect(screen.getByText("SETUP_TABS_billing")).toBeInTheDocument();
  });

  it("기존 repair 링크는 독립 장기수선비 화면으로 전환한다", async () => {
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      SetupPage({ searchParams: Promise.resolve({ tab: "repair" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith("/staff/long-term-repair");
    expect(mocks.setupTabs).not.toHaveBeenCalled();
  });
});
