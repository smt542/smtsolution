import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStaffContext: vi.fn(),
  workspace: vi.fn(),
}));

vi.mock("../_staffContext", () => ({
  getStaffContext: mocks.getStaffContext,
}));
vi.mock("./ReceiptWorkspace", () => ({
  ReceiptWorkspace: (props: {
    orgId: number;
    canSendMessages: boolean;
    canEditPayment: boolean;
    initialPeriod: string | null;
    initialBuildingId: number | null;
    initialUnitId: number | null;
  }) => {
    mocks.workspace(props);
    return <div>RECEIPT_WORKSPACE</div>;
  },
}));

import { ReceiptManagementContent } from "./ReceiptManagementContent";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStaffContext.mockResolvedValue({
    orgId: 7,
    role: "staff",
    permissions: ["payment"],
  });
});

describe("ReceiptManagementContent", () => {
  it("payment·complaints 권한이 모두 없으면 서버에서 접근을 차단한다", async () => {
    mocks.getStaffContext.mockResolvedValue({
      orgId: 7,
      role: "staff",
      permissions: [],
    });

    render(
      await ReceiptManagementContent({ searchParams: Promise.resolve({}) }),
    );

    expect(
      screen.getByText("수납관리·민원접수 권한이 없습니다"),
    ).toBeInTheDocument();
    expect(mocks.workspace).not.toHaveBeenCalled();
  });

  it("complaints 권한만 있어도 조회 화면을 허용하되 결제 편집은 비활성화한다", async () => {
    mocks.getStaffContext.mockResolvedValue({
      orgId: 7,
      role: "staff",
      permissions: ["complaints"],
    });

    render(
      await ReceiptManagementContent({ searchParams: Promise.resolve({}) }),
    );

    expect(screen.getByText("RECEIPT_WORKSPACE")).toBeInTheDocument();
    expect(mocks.workspace).toHaveBeenCalledWith({
      orgId: 7,
      canSendMessages: false,
      canEditPayment: false,
      initialPeriod: null,
      initialBuildingId: null,
      initialUnitId: null,
    });
  });

  it("Next 16 searchParams의 첫 값을 검증해 직렬화 가능한 초기값으로 전달한다", async () => {
    mocks.getStaffContext.mockResolvedValue({
      orgId: 7,
      role: "staff",
      permissions: ["payment", "messaging"],
    });

    render(
      await ReceiptManagementContent({
        searchParams: Promise.resolve({
          period: ["2026-08-01", "2026-09-01"],
          buildingId: ["2", "3"],
          unitId: ["21", "22"],
        }),
      }),
    );

    expect(mocks.workspace).toHaveBeenCalledWith({
      orgId: 7,
      canSendMessages: true,
      canEditPayment: true,
      initialPeriod: "2026-08-01",
      initialBuildingId: 2,
      initialUnitId: 21,
    });
  });

  it("잘못된 쿼리 초기값은 null로 정규화한다", async () => {
    render(
      await ReceiptManagementContent({
        searchParams: Promise.resolve({
          period: "2026-08-31",
          buildingId: "0",
          unitId: "not-a-number",
        }),
      }),
    );

    expect(mocks.workspace).toHaveBeenCalledWith(
      expect.objectContaining({
        initialPeriod: null,
        initialBuildingId: null,
        initialUnitId: null,
      }),
    );
  });
});
