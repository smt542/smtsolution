// app/(staff)/staff/buildings/[id]/components/TenantForm.test.tsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
const push = vi.fn(); const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));
const saveMutate = vi.fn();
const executeMoveOutMutate = vi.fn();
const scheduleMoveOutMutate = vi.fn();
const cancelMoveOutMutate = vi.fn();
let fullData: unknown;
vi.mock("@/hooks/reactquery/occupancies", () => ({
  useSaveUnitOccupancy: () => ({ mutateAsync: saveMutate, isPending: false }),
  useUnitOccupancyFull: () => ({ data: fullData }),
  useExecuteMoveOut: () => ({ mutateAsync: executeMoveOutMutate, isPending: false }),
  useScheduleMoveOut: () => ({ mutateAsync: scheduleMoveOutMutate, isPending: false }),
  useCancelMoveOutSchedule: () => ({ mutateAsync: cancelMoveOutMutate, isPending: false }),
}));
vi.mock("@/hooks/reactquery/roomTypes", () => ({ useRoomTypes: () => ({ data: [{ id: 1, label: "원룸" }] }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { TenantForm } from "./TenantForm";
beforeEach(() => { vi.clearAllMocks(); fullData = undefined; });

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
    fireEvent.change(screen.getByLabelText("관리비 수납 고객번호"), { target: { value: "PAYER-1" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(saveMutate).toHaveBeenCalled());
    const payload = saveMutate.mock.calls[0][0];
    expect(payload.buildingId).toBe(7);
    expect(payload.unit).toEqual({ unitNo: "101", floor: null, usageType: "residential" });
    expect(payload.occupancy).toMatchObject({ tenantName: "김입주", roomTypeId: 1, moveInDate: "2026-01-01", status: "occupied" });
    expect(payload.occupancy).toMatchObject({
      transferMethod: "none", printEnabled: true, billNameDisplay: "name", billDelivery: "post", billAuth: false,
    });
    expect(payload.meters).toHaveLength(3);
    expect(payload.accounts).toHaveLength(4);
    expect(payload.accounts.find((account: { kind: string }) => account.kind === "mgmt")?.payerNo).toBe("PAYER-1");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/buildings/7/tenants/3"));
  });

  it("기존 세대의 용도/층을 저장하고 재로드한다", async () => {
    saveMutate.mockResolvedValue({ unitId: 3, occupancyId: 9 });
    const loaded = {
      unit: { id:3, buildingId:7, unitNo:"301", dong:null, areaPyeong:null, roomCount:null, floor:3, usageType:"residential", memo:null },
      occupancy: {
        id:9, unitId:3, tenantName:"김입주", payerName:"김입주", phone:"010", phone2:null, phone3:null,
        vehicleNo:null, residentCount:1, roomTypeId:1, moveInDate:"2026-01-01", moveOutDate:null,
        status:"occupied", billingEnabled:true, printEnabled:true, lateFeeEnabled:true, singlePrint:false,
        billingNote:null, settlementNote:null, facilityNote:null, transferMethod:"auto_transfer",
        billNameDisplay:"code", billDelivery:"alimtalk", billAuth:true, moveOutScheduledDate:"2026-12-31",
      },
      meters: [], accounts: [], lease: null, history: [],
    };
    const first = render(<TenantForm buildingId={7} unitId={3} />);
    fullData = loaded;
    first.rerender(<TenantForm buildingId={7} unitId={3} />);
    await waitFor(() => {
      expect(screen.getByLabelText("용도")).toHaveValue("residential");
      expect(screen.getByLabelText("층")).toHaveValue(3);
      expect(screen.getByLabelText("이체 방식")).toHaveValue("auto_transfer");
      expect(screen.getByLabelText("고지서 발송")).toHaveValue("alimtalk");
      expect(screen.getByText("2026-12-31 자동 퇴실 예정")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("용도"), { target: { value: "commercial" } });
    fireEvent.change(screen.getByLabelText("층"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(saveMutate).toHaveBeenCalled());
    expect(saveMutate.mock.calls[0][0].unit).toEqual({ unitNo:"301", floor:5, usageType:"commercial" });

    first.unmount();
    fullData = undefined;
    const reloaded = render(<TenantForm buildingId={7} unitId={3} />);
    fullData = { ...loaded, unit: { ...loaded.unit, floor:5, usageType:"commercial" } };
    reloaded.rerender(<TenantForm buildingId={7} unitId={3} />);
    await waitFor(() => {
      expect(screen.getByLabelText("용도")).toHaveValue("commercial");
      expect(screen.getByLabelText("층")).toHaveValue(5);
    });
  });
});
