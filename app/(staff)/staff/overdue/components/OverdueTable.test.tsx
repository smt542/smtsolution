import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OverdueHousehold } from "@/hooks/reactquery/overdue";
import { OverdueTable } from "./OverdueTable";

const row = {
  occupancyId: 1,
  unitId: 1,
  buildingId: 1,
  buildingName: "그린빌라",
  unitNo: "101호",
  dong: "A동",
  tenantName: "김입주",
  phone: "010-0000-0000",
  status: "occupied",
  overdueMonths: 3,
  overdueAmount: 100_000,
  lastPaymentDate: null,
  billingAvailable: true,
  lateFeeAmount: 3_400,
} as OverdueHousehold;

describe("OverdueTable", () => {
  it("Figma 원장 열과 호합·고정 합계를 렌더한다", () => {
    render(
      <OverdueTable
        rows={[row]}
        selectedIds={new Set()}
        onToggleOne={vi.fn()}
        onToggleAll={vi.fn()}
        onRowClick={vi.fn()}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "납.연체료" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "납.후연체" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "연체료계" })).toBeInTheDocument();
    expect(screen.getByText("[호합]")).toBeInTheDocument();
    expect(screen.getByText("항목 1 / 1건")).toBeInTheDocument();
    expect(screen.getAllByText("100,000")).toHaveLength(3);
    expect(screen.getAllByText("3,400")).toHaveLength(6);
  });
});
