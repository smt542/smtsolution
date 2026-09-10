import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStaffContext: vi.fn(),
  getBillPageData: vi.fn(),
}));

vi.mock("../_staffContext", () => ({ getStaffContext: mocks.getStaffContext }));
vi.mock("./data", () => ({ getBillPageData: mocks.getBillPageData }));
vi.mock("./components/BillWorkspace", () => ({
  BillWorkspace: ({ companyName, buildings }: { companyName: string; buildings: Array<{ name: string }> }) => (
    <div>WORKSPACE:{companyName}:{buildings[0]?.name}</div>
  ),
}));

import BillPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBillPageData.mockResolvedValue({
    buildings: [{ id: 7, code: "B007", name: "행복빌라", address: "서울시" }],
    companyName: "한빛관리",
    accounts: [],
    customerNotice: null,
  });
});

describe("BillPage 권한 게이트", () => {
  it("bill_publish 권한이 없으면 차단하고 페이지 데이터를 조회하지 않는다", async () => {
    mocks.getStaffContext.mockResolvedValue({ orgId: 1, role: "staff", permissions: [] });

    render(await BillPage());

    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
    expect(mocks.getBillPageData).not.toHaveBeenCalled();
  });

  it("권한이 있으면 서버 데이터를 Client workspace에 전달한다", async () => {
    mocks.getStaffContext.mockResolvedValue({ orgId: 1, role: "staff", permissions: ["bill_publish"] });

    render(await BillPage());

    expect(screen.getByText("WORKSPACE:한빛관리:행복빌라")).toBeInTheDocument();
    expect(mocks.getBillPageData).toHaveBeenCalledWith(1);
  });

  it("org_owner는 별도 모듈 권한 없이 접근할 수 있다", async () => {
    mocks.getStaffContext.mockResolvedValue({ orgId: 1, role: "org_owner", permissions: [] });

    render(await BillPage());

    expect(screen.getByText("WORKSPACE:한빛관리:행복빌라")).toBeInTheDocument();
  });
});
