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
  it("입주민 행을 클릭하면 해당 입주자카드를 연다", () => {
    const onOpenTenantCard = vi.fn();
    render(
      <TenantOccupancyCard
        buildingId={7}
        buildingName="그린빌라"
        rows={[tenant]}
        isLoading={false}
        isError={false}
        onOpenTenantCard={onOpenTenantCard}
      />,
    );

    fireEvent.click(screen.getByRole("row", { name: "101호 홍길동 입주자카드 보기" }));

    expect(onOpenTenantCard).toHaveBeenCalledWith(tenant);
  });

  it("입주민 행에서 Enter를 눌러도 입주자카드를 연다", () => {
    const onOpenTenantCard = vi.fn();
    render(
      <TenantOccupancyCard
        buildingId={7}
        buildingName="그린빌라"
        rows={[tenant]}
        isLoading={false}
        isError={false}
        onOpenTenantCard={onOpenTenantCard}
      />,
    );

    fireEvent.keyDown(screen.getByRole("row", { name: "101호 홍길동 입주자카드 보기" }), { key: "Enter" });

    expect(onOpenTenantCard).toHaveBeenCalledWith(tenant);
  });
});
