import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TenantManagementCardModal } from "./TenantManagementCardModal";

vi.mock("../[id]/components/TenantForm", () => ({
  TenantForm: ({
    buildingId,
    unitId,
    presentation,
  }: {
    buildingId: number;
    unitId: number;
    presentation: string;
  }) => <div>{`FORM:${buildingId}:${unitId}:${presentation}`}</div>,
}));

describe("TenantManagementCardModal", () => {
  it("선택한 건물과 세대의 관리 폼을 모달로 표시한다", () => {
    render(<TenantManagementCardModal buildingId={7} unitId={101} onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "입주민 관리카드" })).toBeInTheDocument();
    expect(screen.getByText("FORM:7:101:modal")).toBeInTheDocument();
  });

  it("Escape를 누르면 닫힌다", () => {
    const onClose = vi.fn();
    render(<TenantManagementCardModal buildingId={7} unitId={101} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
