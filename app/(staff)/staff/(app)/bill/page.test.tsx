import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStaffContext: vi.fn(),
}));

vi.mock("../_staffContext", () => ({ getStaffContext: mocks.getStaffContext }));
vi.mock("./components/BillWorkspace", () => ({
  BillWorkspace: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import BillPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BillPage 권한 게이트", () => {
  it("bill_publish 권한이 없으면 차단한다", async () => {
    mocks.getStaffContext.mockResolvedValue({ orgId: 1, role: "staff", permissions: [] });

    render(await BillPage());

    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
  });

  it("권한이 있으면 페이지 데이터 조회 없이 정적 메뉴를 렌더링한다", async () => {
    mocks.getStaffContext.mockResolvedValue({ orgId: 1, role: "staff", permissions: ["bill_publish"] });

    render(await BillPage());

    expect(screen.getByRole("heading", { name: "서류 발행·출력" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /지로 고지서/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /조정명세서/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /자동이체 세대 출력/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /팩스 발송/ })).toBeInTheDocument();
  });

  it("org_owner는 별도 모듈 권한 없이 접근할 수 있다", async () => {
    mocks.getStaffContext.mockResolvedValue({ orgId: 1, role: "org_owner", permissions: [] });

    render(await BillPage());

    expect(screen.getByRole("heading", { name: "서류 발행·출력" })).toBeInTheDocument();
  });
});
