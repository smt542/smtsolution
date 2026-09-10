import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./components/BillingSettingsTab", () => ({
  BillingSettingsTab: () => <div>TAB_BILLING</div>,
}));
vi.mock("./components/AccountSettingsTab", () => ({
  AccountSettingsTab: () => <div>TAB_ACCOUNTS</div>,
}));
vi.mock("./components/MovingSettlementSettingsTab", () => ({
  MovingSettlementSettingsTab: () => <div>TAB_SETTLEMENT</div>,
}));
vi.mock("./components/SystemSettingsTab", () => ({
  SystemSettingsTab: () => <div>TAB_SYSTEM</div>,
}));

import { SetupTabs } from "./SetupTabs";

describe("SetupTabs", () => {
  it("서버에서 받은 초기 탭을 렌더한다", async () => {
    render(<SetupTabs initialTab="system" />);

    expect(await screen.findByText("TAB_SYSTEM")).toBeInTheDocument();
  });

  it("탭 클릭 시 기존처럼 화면을 전환한다", async () => {
    render(<SetupTabs initialTab="billing" />);
    expect(await screen.findByText("TAB_BILLING")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "시스템 설정" }));

    expect(await screen.findByText("TAB_SYSTEM")).toBeInTheDocument();
  });
});
