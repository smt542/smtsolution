// app/(staff)/staff/buildings/[id]/components/TenantForm.test.tsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
const push = vi.fn(); const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));
const saveMutate = vi.fn();
vi.mock("@/hooks/reactquery/occupancies", () => ({
  useSaveUnitOccupancy: () => ({ mutateAsync: saveMutate, isPending: false }),
  useUnitOccupancyFull: () => ({ data: undefined }),
}));
vi.mock("@/hooks/reactquery/roomTypes", () => ({ useRoomTypes: () => ({ data: [{ id: 1, label: "원룸" }] }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { TenantForm } from "./TenantForm";
beforeEach(() => vi.clearAllMocks());

describe("TenantForm 등록", () => {
  it("필수 미입력 시 저장 안 함", async () => {
    render(<TenantForm buildingId={7} />);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(saveMutate).not.toHaveBeenCalled());
  });
  it("필수 입력 후 저장 → saveUnitOccupancy + 상세 replace", async () => {
    saveMutate.mockResolvedValue({ unitId: 3, occupancyId: 9 });
    render(<TenantForm buildingId={7} />);
    fireEvent.change(screen.getByLabelText("호실명"), { target: { value: "101" } });
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김입주" } });
    fireEvent.change(screen.getByLabelText("입금자명"), { target: { value: "김입주" } });
    fireEvent.change(screen.getByLabelText("룸타입"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("연락처1"), { target: { value: "010" } });
    fireEvent.change(screen.getByLabelText("입주일"), { target: { value: "2026-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(saveMutate).toHaveBeenCalled());
    const payload = saveMutate.mock.calls[0][0];
    expect(payload.buildingId).toBe(7);
    expect(payload.occupancy).toMatchObject({ tenantName: "김입주", roomTypeId: 1, moveInDate: "2026-01-01", status: "occupied" });
    expect(payload.meters).toHaveLength(3);
    expect(payload.accounts).toHaveLength(4);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/buildings/7/tenants/3"));
  });
});
