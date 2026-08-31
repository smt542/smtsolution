import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TenantOutputModal } from "./TenantOutputModal";

vi.mock("@/hooks/reactquery/auth", () => ({
  useMe: () => ({ data: { orgId: 9 } }),
}));

vi.mock("@/hooks/reactquery/buildings", () => ({
  useBuildings: () => ({
    data: [{ id: 7, orgId: 9, code: "B0007", name: "그린빌라", address: "서울시" }],
  }),
}));

vi.mock("@/hooks/reactquery/occupancies", () => ({
  useTenantList: () => ({
    data: [
      { unitId: 101, unitNo: "101", tenantName: "김하나", isVacant: false },
      { unitId: 202, unitNo: "202", tenantName: "이둘", isVacant: false },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/reactquery/bill", () => ({
  useBillOrganizationName: () => ({ data: "관리비서" }),
  useBillTargets: () => ({ data: [] }),
  useBillDocuments: () => ({ data: [] }),
}));

vi.mock("@/lib/billing/period", () => ({
  currentPeriod: () => "2026-08",
}));

vi.mock("./tenant-output/BuildingPickerList", () => ({
  BuildingPickerList: () => <aside>건물 선택</aside>,
}));

vi.mock("./tenant-output/PreviewPane", () => ({
  PreviewPane: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

vi.mock("./tenant-output/TenantCardDocument", () => ({
  TenantCardDocument: ({ tenant }: { tenant: { unitId: number } }) => <div>CARD:{tenant.unitId}</div>,
}));

vi.mock("./tenant-output/ChargeStatementDocument", () => ({
  ChargeStatementDocument: () => <div>STATEMENT</div>,
}));

describe("TenantOutputModal", () => {
  it("입주민 행에서 열면 해당 세대의 입주자카드를 첫 화면에 표시한다", async () => {
    render(<TenantOutputModal initialBuildingId={7} initialUnitId={202} onClose={vi.fn()} />);

    expect(await screen.findByText("CARD:202")).toBeInTheDocument();
  });
});
