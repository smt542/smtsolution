import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantListRow } from "@/hooks/reactquery/occupancies";
import { TenantOccupancyCard } from "./TenantOccupancyCard";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

const tenant: TenantListRow = {
  unitId: 101,
  occupancyId: 1001,
  unitNo: "101",
  tenantName: "홍길동",
  phone: "010-1234-5678",
  roomTypeLabel: "원룸",
  residentCount: 1,
  moveInDate: "2026-08-01",
  isVacant: false,
  isOverdue: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TenantOccupancyCard", () => {
  it("입주민 행을 클릭하면 해당 입주민 관리카드를 연다", () => {
    const onOpenManagementCard = vi.fn();
    render(
      <TenantOccupancyCard
        buildingId={7}
        buildingName="그린빌라"
        rows={[tenant]}
        isLoading={false}
        isError={false}
        onOpenManagementCard={onOpenManagementCard}
      />,
    );

    fireEvent.click(screen.getByRole("row", { name: "101호 홍길동 입주민 관리카드 보기" }));

    expect(onOpenManagementCard).toHaveBeenCalledWith(tenant);
  });

  it("입주민 행에서 Enter를 눌러도 입주민 관리카드를 연다", () => {
    const onOpenManagementCard = vi.fn();
    render(
      <TenantOccupancyCard
        buildingId={7}
        buildingName="그린빌라"
        rows={[tenant]}
        isLoading={false}
        isError={false}
        onOpenManagementCard={onOpenManagementCard}
      />,
    );

    fireEvent.keyDown(screen.getByRole("row", { name: "101호 홍길동 입주민 관리카드 보기" }), { key: "Enter" });

    expect(onOpenManagementCard).toHaveBeenCalledWith(tenant);
  });

  it("헤더 인원 배지는 공실을 제외한 입주 세대 수를 표시한다", () => {
    render(
      <TenantOccupancyCard
        buildingId={7}
        buildingName="그린빌라"
        rows={[tenant, { ...tenant, unitId: 102, unitNo: "102", occupancyId: null, tenantName: null, isVacant: true }]}
        isLoading={false}
        isError={false}
        onOpenManagementCard={vi.fn()}
      />,
    );

    expect(screen.getByText("1명", { selector: "header span" })).toBeInTheDocument();
  });
});
