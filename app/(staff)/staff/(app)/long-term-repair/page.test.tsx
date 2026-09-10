import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStaffContext: vi.fn(),
  getPageData: vi.fn(),
}));

vi.mock("../_staffContext", () => ({ getStaffContext: mocks.getStaffContext }));
vi.mock("./data", () => ({ getLongTermRepairPageData: mocks.getPageData }));
vi.mock("./components/LongTermRepairLedger", () => ({
  LongTermRepairLedger: ({ orgId, companyName, buildings }: {
    orgId: number;
    companyName: string;
    buildings: Array<{ name: string }>;
  }) => <div>LEDGER:{orgId}:{companyName}:{buildings[0]?.name}</div>,
}));

import LongTermRepairPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPageData.mockResolvedValue({
    buildings: [{ id: 3, code: "B001", name: "한빛빌딩" }],
    organizationName: "한빛관리",
  });
});

describe("LongTermRepairPage", () => {
  it("settings 권한 없는 일반 계정의 접근을 차단한다", async () => {
    mocks.getStaffContext.mockResolvedValue({ orgId: 9, role: "staff", permissions: [] });

    render(await LongTermRepairPage());

    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/LEDGER/)).toBeNull();
    expect(mocks.getPageData).not.toHaveBeenCalled();
  });

  it("마스터는 별도 권한 없이 원장 화면을 사용한다", async () => {
    mocks.getStaffContext.mockResolvedValue({ orgId: 9, role: "org_owner", permissions: [] });

    render(await LongTermRepairPage());

    expect(screen.getByText("LEDGER:9:한빛관리:한빛빌딩")).toBeInTheDocument();
    expect(mocks.getPageData).toHaveBeenCalledWith(9);
  });

  it("settings 권한 일반 계정도 원장 화면을 사용한다", async () => {
    mocks.getStaffContext.mockResolvedValue({ orgId: 9, role: "staff", permissions: ["settings"] });

    render(await LongTermRepairPage());

    expect(screen.getByText("LEDGER:9:한빛관리:한빛빌딩")).toBeInTheDocument();
  });
});
