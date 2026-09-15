import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/residentClaims", () => ({
  useResidentClaims: vi.fn(),
  useApproveResidentClaim: vi.fn(),
  useRejectResidentClaim: vi.fn(),
}));
vi.mock("./useOrgOccupancyLookup", () => ({ useOrgOccupancyLookup: vi.fn() }));
vi.mock("@/hooks/common/useAppToast", () => ({ appToast: { error: vi.fn(), success: vi.fn() } }));

import { ResidentClaimsPanel } from "./ResidentClaimsPanel";
import {
  useApproveResidentClaim,
  useRejectResidentClaim,
  useResidentClaims,
  type ResidentClaim,
} from "@/hooks/reactquery/residentClaims";
import { useOrgOccupancyLookup } from "./useOrgOccupancyLookup";

const approveMutateAsync = vi.fn();
const rejectMutateAsync = vi.fn();

const claims: ResidentClaim[] = [
  {
    claimId: 31, orgId: 1, residentUserId: "resident-1", kakaoId: "unknown_2210",
    kakaoName: "윤소라", residentPhone: "010-6654-2210", claimedName: "윤소라",
    claimedPhone: "010-6654-2210", buildingId: 7, buildingName: "그린빌라",
    unitId: null, unitNo: null, claimedUnitText: "101", occupancyId: null,
    occupancyTenantName: null, occupancyPhone: null, status: "pending", kind: "manual",
    memo: null, createdAt: "2026-08-07T10:12:00.000Z", resolvedAt: null, resolvedBy: null,
  },
  {
    claimId: 32, orgId: 1, residentUserId: "resident-2", kakaoId: "hong_kakao",
    kakaoName: "홍길동", residentPhone: "010-1234-5678", claimedName: "홍길동",
    claimedPhone: "010-1234-5678", buildingId: 8, buildingName: "한빛상가",
    unitId: 12, unitNo: "B02", claimedUnitText: null, occupancyId: 102,
    occupancyTenantName: "홍길동", occupancyPhone: "010-1234-5678", status: "linked", kind: "auto",
    memo: null, createdAt: "2026-05-12T09:00:00.000Z", resolvedAt: "2026-05-12T09:01:00.000Z", resolvedBy: "staff-1",
  },
  {
    claimId: 33, orgId: 1, residentUserId: "resident-3", kakaoId: "kko_7745",
    kakaoName: "김도현", residentPhone: "010-3390-7745", claimedName: "김도현",
    claimedPhone: "010-3390-7745", buildingId: 9, buildingName: "푸른아파트",
    unitId: null, unitNo: null, claimedUnitText: "802", occupancyId: null,
    occupancyTenantName: null, occupancyPhone: null, status: "rejected", kind: "search",
    memo: null, createdAt: "2026-08-01T09:00:00.000Z", resolvedAt: "2026-08-02T09:00:00.000Z", resolvedBy: "staff-1",
  },
];

function setup() {
  vi.mocked(useResidentClaims).mockReturnValue({
    data: claims, isLoading: false, isError: false,
  } as unknown as ReturnType<typeof useResidentClaims>);
  approveMutateAsync.mockResolvedValue(undefined);
  rejectMutateAsync.mockResolvedValue(undefined);
  vi.mocked(useApproveResidentClaim).mockReturnValue({
    mutateAsync: approveMutateAsync, isPending: false,
  } as unknown as ReturnType<typeof useApproveResidentClaim>);
  vi.mocked(useRejectResidentClaim).mockReturnValue({
    mutateAsync: rejectMutateAsync, isPending: false,
  } as unknown as ReturnType<typeof useRejectResidentClaim>);
  vi.mocked(useOrgOccupancyLookup).mockReturnValue({
    data: [
      {
        occupancyId: 101, buildingId: 7, buildingName: "그린빌라", unitId: 11,
        unitNo: "101", tenantName: "정민수", phone: "010-5521-8890",
      },
      {
        occupancyId: 102, buildingId: 8, buildingName: "한빛상가", unitId: 12,
        unitNo: "B02", tenantName: "홍길동", phone: "010-1234-5678",
      },
    ],
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useOrgOccupancyLookup>);
}

beforeEach(() => {
  vi.clearAllMocks();
  setup();
});

describe("ResidentClaimsPanel", () => {
  it("프로토타입 열과 건물 및 연결 상태 필터를 표시", async () => {
    const user = userEvent.setup();
    render(<ResidentClaimsPanel />);

    for (const column of ["건물명", "호실", "입주자명", "연락처", "카카오 ID", "카카오 이름", "연결 상태", "연결일"]) {
      expect(screen.getByRole("columnheader", { name: column })).toBeInTheDocument();
    }
    expect(screen.getByText("2026.08.07")).toBeInTheDocument();
    expect(screen.getByText("2026.05.12")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "건물 전체" }), "한빛상가");
    expect(screen.getByText("hong_kakao")).toBeInTheDocument();
    expect(screen.queryByText("unknown_2210")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "건물 전체" }), "");
    await user.click(screen.getByRole("button", { name: "미연결" }));
    expect(screen.getByText("kko_7745")).toBeInTheDocument();
    expect(screen.queryByText("hong_kakao")).not.toBeInTheDocument();
  });

  it("pending 청구에서 세대를 검색하고 확인 후 연결", async () => {
    const user = userEvent.setup();
    render(<ResidentClaimsPanel />);

    await user.click(screen.getByRole("button", { name: /unknown_2210/ }));
    expect(screen.getByRole("heading", { name: "세대 연결" })).toBeInTheDocument();
    expect(screen.getByText(/이 카카오 계정을 연결할 세대를 선택해 주세요/)).toBeInTheDocument();

    const search = screen.getByPlaceholderText("건물명 또는 호실 검색");
    await user.type(search, "101");
    await user.click(screen.getByRole("button", { name: /그린빌라 101호/ }));
    await user.click(screen.getByRole("button", { name: "연결하기" }));

    expect(screen.getByRole("heading", { name: "이 세대로 연결할까요?" })).toBeInTheDocument();
    expect(screen.getByText(/관리비·공지 정보를 열람하게 됩니다/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "연결" }));

    await waitFor(() => expect(approveMutateAsync).toHaveBeenCalledWith({
      claimId: 31,
      occupancyId: 101,
    }));
  });

  it("pending 청구를 삭제하면 reject mutation을 호출", async () => {
    const user = userEvent.setup();
    render(<ResidentClaimsPanel />);

    await user.click(screen.getByRole("button", { name: /unknown_2210/ }));
    await user.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(rejectMutateAsync).toHaveBeenCalledWith(31));
    expect(screen.queryByRole("heading", { name: "세대 연결" })).not.toBeInTheDocument();
  });
});
