import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: () => ({ data: { orgId: 9 } }) }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildingList: () => ({ data: { rows: [{ id: 3, name: "행복빌라" }], total: 1 } }) }));
const createMut = vi.fn().mockResolvedValue({});
const repairsMock = vi.fn();
vi.mock("@/hooks/reactquery/longTermRepair", () => ({
  useRepairsByBuilding: (id?: number) => repairsMock(id),
  useCreateRepair: () => ({ mutateAsync: createMut, isPending: false }),
  useUpdateRepair: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteRepair: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRepairAttachments: () => ({ data: [] }),
  useUploadRepairAttachment: () => ({ mutateAsync: vi.fn() }),
  useDeleteRepairAttachment: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { LongTermRepairTab } from "./LongTermRepairTab";
beforeEach(() => { vi.clearAllMocks(); createMut.mockResolvedValue({}); repairsMock.mockReturnValue({ data: [] }); });

describe("LongTermRepairTab", () => {
  it("건물 미선택 안내", () => {
    render(<LongTermRepairTab />);
    expect(screen.getByText(/건물을 선택하면/)).toBeInTheDocument();
  });
  it("건물 선택 시 이력 로드", () => {
    repairsMock.mockReturnValue({ data: [{ id: 1, orgId: 9, buildingId: 3, workName: "방수공사", workDate: "2026-05-01", amount: 500000, memo: null }] });
    render(<LongTermRepairTab />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "3" } });
    expect(screen.getByText("방수공사")).toBeInTheDocument();
  });
  it("이력 추가 → createRepair", async () => {
    render(<LongTermRepairTab />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /이력 추가/ }));
    fireEvent.change(screen.getByLabelText("공사명"), { target: { value: "도장공사" } });
    fireEvent.change(screen.getByLabelText("금액"), { target: { value: "300000" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    await waitFor(() => expect(createMut).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 9, buildingId: 3, workName: "도장공사", amount: 300000 })
    ));
  });
});
