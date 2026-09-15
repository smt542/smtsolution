// app/(staff)/staff/buildings/[id]/components/TenantForm.test.tsx
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
const push = vi.fn(); const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));
const saveMutate = vi.fn();
const executeMoveOutMutate = vi.fn();
const scheduleMoveOutMutate = vi.fn();
const cancelMoveOutMutate = vi.fn();
let fullData: unknown;
const deleteMutate = vi.fn();
vi.mock("@/hooks/reactquery/occupancies", () => ({
  useSaveUnitOccupancy: () => ({ mutateAsync: saveMutate, isPending: false }),
  useUnitOccupancyFull: () => ({ data: fullData }),
  useDeleteUnit: () => ({ mutateAsync: deleteMutate, isPending: false }),
  useExecuteMoveOut: () => ({ mutateAsync: executeMoveOutMutate, isPending: false }),
  useScheduleMoveOut: () => ({ mutateAsync: scheduleMoveOutMutate, isPending: false }),
  useCancelMoveOutSchedule: () => ({ mutateAsync: cancelMoveOutMutate, isPending: false }),
}));
vi.mock("@/hooks/reactquery/roomTypes", () => ({ useRoomTypes: () => ({ data: [{ id: 1, label: "원룸" }] }) }));
vi.mock("@/hooks/reactquery/buildingCustomerNumbers", () => ({
  useCustomerNumbers: () => ({
    data: [
      { id: 1, kind: "water", customerNo: "W-1" },
      { id: 2, kind: "elec", customerNo: "E-1" },
      { id: 3, kind: "common_elec", customerNo: "CE-1" },
      { id: 4, kind: "gas", customerNo: "G-1" },
    ],
  }),
}));
vi.mock("@/hooks/common/useAppToast", () => ({ appToast: { success: vi.fn(), error: vi.fn() } }));
import { TenantForm } from "./TenantForm";
beforeEach(() => { vi.clearAllMocks(); fullData = undefined; });

// 커스텀 SelectField(<button> 트리거 + role="listbox" 팝오버)에서 라벨의 필드를 열고 옵션 텍스트를 클릭한다.
function selectOption(fieldLabel: string | RegExp, optionText: string) {
  const trigger = screen.getByLabelText(fieldLabel);
  fireEvent.click(trigger);
  const listbox = screen.getByRole("listbox");
  fireEvent.click(within(listbox).getByText(optionText));
}

// 커스텀 DateField(<button> 트리거 + role="dialog" 인라인 달력)를 열어 현재 달의 특정 일자를 클릭한다.
function pickDay(fieldLabel: string | RegExp, day: string) {
  const trigger = screen.getByLabelText(fieldLabel);
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: day }));
}

describe("TenantForm 등록", () => {
  it("필수 미입력 시 저장 안 함", async () => {
    render(<TenantForm buildingId={7} />);
    fireEvent.click(screen.getByRole("button", { name: "등록 저장" }));
    await waitFor(() => expect(saveMutate).not.toHaveBeenCalled());
  });
  it("필수 입력 후 저장 → saveUnitOccupancy + 상세 replace", async () => {
    saveMutate.mockResolvedValue({ unitId: 3, occupancyId: 9 });
    render(<TenantForm buildingId={7} />);
    fireEvent.change(screen.getByLabelText(/^호실/), { target: { value: "101" } });
    fireEvent.change(screen.getByLabelText("입주자명"), { target: { value: "김입주" } });
    fireEvent.change(screen.getByLabelText("입금자명"), { target: { value: "김입주" } });
    selectOption("룸", "원룸");
    fireEvent.change(screen.getByLabelText(/^전화번호/), { target: { value: "010" } });
    pickDay("입주일", "15");
    selectOption("수도 고객번호", "W-1");
    fireEvent.click(screen.getByRole("button", { name: "등록 저장" }));
    await waitFor(() => expect(saveMutate).toHaveBeenCalled());
    const payload = saveMutate.mock.calls[0][0];
    expect(payload.buildingId).toBe(7);
    expect(payload.unit).toEqual({
      unitNo: "101", dong: null, areaPyeong: null, roomCount: null, floor: null, usageType: "residential",
    });
    expect(payload.occupancy).toMatchObject({ tenantName: "김입주", roomTypeId: 1, moveInDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), status: "occupied" });
    expect(payload.occupancy).toMatchObject({
      transferMethod: "giro", printEnabled: true, billNameDisplay: "none", billDelivery: "alimtalk", billAuth: false,
      smsOptIn: true, alimtalkOptIn: true,
    });
    expect(payload.meters).toHaveLength(5);
    expect(payload.meters.find((meter: { utility: string }) => meter.utility === "water")?.customerNo).toBe("W-1");
    expect(payload.accounts).toEqual([]);
    expect(payload.property).toMatchObject({ propertyType: "oneroom", dealType: "direct", rentType: "month" });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/buildings/7/tenants/3"));
  });

  it("화면에서 숨긴 기존 세대의 용도·층·팩스·계약알림을 저장 시 보존한다", async () => {
    saveMutate.mockResolvedValue({ unitId: 3, occupancyId: 9 });
    const loaded = {
      unit: { id:3, buildingId:7, unitNo:"301", dong:null, areaPyeong:null, roomCount:null, floor:3, usageType:"residential", memo:null },
      occupancy: {
        id:9, unitId:3, tenantName:"김입주", payerName:"김입주", phone:"010", phone2:null, phone3:null, faxNumber:"02-5555-0000",
        vehicleNo:null, residentCount:1, roomTypeId:1, moveInDate:"2026-01-01", moveOutDate:null,
        status:"occupied", billingEnabled:true, printEnabled:true, lateFeeEnabled:true, singlePrint:false,
        billingNote:null, settlementNote:null, facilityNote:null, transferMethod:"auto_transfer",
        billNameDisplay:"code", billDelivery:"alimtalk", billAuth:true, moveOutScheduledDate:"2026-12-31",
      },
      meters: [], accounts: [],
      lease: { id:4, occupancyId:9, deposit:null, monthlyRent:null, startDate:null, endDate:null, expiryAlert:true,
        leaseType:null, depositDate:null, jeonseDeposit:null, bankAccount:null },
      history: [], property: null,
    };
    const first = render(<TenantForm buildingId={7} unitId={3} />);
    fullData = loaded;
    first.rerender(<TenantForm buildingId={7} unitId={3} />);
    await waitFor(() => {
      expect(screen.getByLabelText(/^호실/)).toHaveValue("301");
    });
    // 이체 방식·발송은 커스텀 SelectField(value 없음) → 트리거 버튼에 표시된 라벨 텍스트로 검증한다.
    const transferField = screen.getByText("이체 방식").closest("label") as HTMLElement;
    expect(within(transferField).getByRole("button")).toHaveTextContent("자동이체");
    const deliveryField = screen.getByText("발송").closest("label") as HTMLElement;
    expect(within(deliveryField).getByRole("button")).toHaveTextContent("알림톡 고지서");
    // 퇴실 예약 배너는 "퇴실처리" 모달 안 → 모달을 열어 확인한 뒤 닫아 저장 흐름과 분리한다.
    fireEvent.click(screen.getByRole("button", { name: "퇴실처리" }));
    expect(screen.getByText("2026-12-31 자동 퇴실 예정")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("2026-12-31 자동 퇴실 예정")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "등록 저장" }));
    await waitFor(() => expect(saveMutate).toHaveBeenCalled());
    expect(saveMutate.mock.calls[0][0].unit).toMatchObject({ unitNo:"301", floor:3, usageType:"residential" });
    expect(saveMutate.mock.calls[0][0].occupancy).toMatchObject({ faxNumber:"02-5555-0000", billAuth:true });
    expect(saveMutate.mock.calls[0][0].lease).toMatchObject({ expiryAlert:true });
  });
});
