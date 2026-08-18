/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/asCategories", () => ({ useAsCategories: vi.fn() }));
vi.mock("@/hooks/reactquery/complaints", () => ({ useComplaints: vi.fn() }));

import AsStatusPage, { asStatusExportUrl } from "./page";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useAsCategories } from "@/hooks/reactquery/asCategories";
import { useComplaints } from "@/hooks/reactquery/complaints";

const complaint = {
  id: 11,
  orgId: 7,
  buildingId: 2,
  unitId: 21,
  categoryId: 4,
  title: "욕실 수전 누수",
  content: "물이 계속 떨어집니다.",
  status: "pending",
  receivedAt: "2026-08-12T00:00:00.000Z",
  createdAt: "2026-08-12T00:00:00.000Z",
  buildingName: "그린빌라",
  unitNo: "101호",
  unitDong: "A동",
  categoryLabel: "수도",
  resolutions: [{
    id: 91,
    complaintId: 11,
    resultContent: "패킹 교체 완료",
    createdAt: "2026-08-12T03:00:00.000Z",
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useMe).mockReturnValue({
    data: { orgId: 7, role: "org_owner", permissions: [] },
    isLoading: false,
  } as any);
  vi.mocked(useBuildings).mockReturnValue({
    data: [{ id: 2, orgId: 7, name: "그린빌라" }],
    isLoading: false,
  } as any);
  vi.mocked(useAsCategories).mockReturnValue({
    data: [{ id: 4, orgId: 7, label: "수도" }],
    isLoading: false,
  } as any);
  vi.mocked(useComplaints).mockReturnValue({
    data: [complaint],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as any);
});

describe("AsStatusPage", () => {
  it("건물·날짜 필터, 목록, 출력·엑셀 액션을 표시한다", () => {
    render(<AsStatusPage />);

    expect(screen.getByRole("heading", { name: "AS접수현황" })).toBeInTheDocument();
    expect(screen.getByLabelText("AS 건물 필터")).toBeInTheDocument();
    expect(screen.getByLabelText("AS 접수 시작일")).toBeInTheDocument();
    expect(screen.getByText("패킹 교체 완료")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "건물별 월별 출력" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "엑셀 다운로드" })).toBeInTheDocument();
  });

  it("호실 더블클릭 시 건물·호실 자동검색 쿼리로 이동한다", () => {
    render(<AsStatusPage />);

    fireEvent.doubleClick(screen.getByText("A동 101호"));

    expect(push).toHaveBeenCalledWith(
      "/staff/receipts?buildingId=2&unit=A%EB%8F%99+101%ED%98%B8",
    );
  });

  it("현재 조회 필터를 Excel API URL에 보존한다", () => {
    expect(asStatusExportUrl({
      buildingId: "2",
      categoryId: "4",
      receivedFrom: "2026-08-01",
      receivedTo: "2026-08-31",
    })).toBe(
      "/api/receipts/as-status/export?buildingId=2&categoryId=4&receivedFrom=2026-08-01&receivedTo=2026-08-31",
    );
  });
});
