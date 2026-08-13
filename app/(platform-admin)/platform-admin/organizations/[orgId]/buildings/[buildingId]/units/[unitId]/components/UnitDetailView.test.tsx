import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/hooks/reactquery/platform", () => ({ useUnitOccupancy: vi.fn() }));
import { UnitDetailView } from "./UnitDetailView";
import { useUnitOccupancy } from "@/hooks/reactquery/platform";
beforeEach(() => vi.clearAllMocks());

describe("UnitDetailView", () => {
  it("입주 정보 + 빵부스러기 렌더", () => {
    vi.mocked(useUnitOccupancy).mockReturnValue({ isPending: false, isError: false, data: {
      unitId: 11, unitNo: "101", dong: "가", areaPyeong: 24, roomCount: 2,
      buildingId: 7, buildingName: "가나빌", orgId: 3, orgName: "가나관리",
      occupancy: { occupancyId: 22, tenantName: "홍길동", payerName: "홍길동", phone: "010", phone2: null, phone3: null, vehicleNo: null, residentCount: 2, roomTypeLabel: "원룸", moveInDate: "2026-01-01", moveOutDate: null, status: "occupied", billingNote: null, facilityNote: null },
    } } as never);
    render(<UnitDetailView orgId={3} buildingId={7} unitId={11} />);
    expect(screen.getAllByText("홍길동")[0]).toBeInTheDocument();
    expect(screen.getByText("가나관리")).toBeInTheDocument();
    expect(screen.getByText("가나빌")).toBeInTheDocument();
  });
  it("공실 안내", () => {
    vi.mocked(useUnitOccupancy).mockReturnValue({ isPending: false, isError: false, data: {
      unitId: 12, unitNo: "102", dong: null, areaPyeong: null, roomCount: null,
      buildingId: 7, buildingName: "가나빌", orgId: 3, orgName: "가나관리", occupancy: null,
    } } as never);
    render(<UnitDetailView orgId={3} buildingId={7} unitId={12} />);
    expect(screen.getByText("현재 입주 정보가 없습니다(공실).")).toBeInTheDocument();
  });
});
