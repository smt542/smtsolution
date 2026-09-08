import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/hooks/reactquery/accounts", () => ({
  useAccounts: vi.fn(), useCreateAccount: vi.fn(), useUpdateAccountBasic: vi.fn(),
  useUpdatePermissions: vi.fn(), useSetActive: vi.fn(), useResetPassword: vi.fn(),
}));
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/residentClaims", () => ({
  useResidentClaims: vi.fn(),
  useApproveResidentClaim: vi.fn(),
  useRejectResidentClaim: vi.fn(),
}));
vi.mock("./components/useOrgOccupancyLookup", () => ({ useOrgOccupancyLookup: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import AccountsPage from "./page";
import {
  useAccounts, useCreateAccount, useUpdateAccountBasic, useUpdatePermissions, useSetActive, useResetPassword,
} from "@/hooks/reactquery/accounts";
import { useMe, type MyContext } from "@/hooks/reactquery/auth";
import {
  useApproveResidentClaim,
  useRejectResidentClaim,
  useResidentClaims,
} from "@/hooks/reactquery/residentClaims";
import { useOrgOccupancyLookup } from "./components/useOrgOccupancyLookup";

const createMutateAsync = vi.fn();
const basicMutateAsync = vi.fn();
const permissionMutateAsync = vi.fn();
const activeMutateAsync = vi.fn();
const resetPasswordMutateAsync = vi.fn();
const approveClaimMutateAsync = vi.fn();
const rejectClaimMutateAsync = vi.fn();
const master: MyContext = {
  orgId: 1, role: "org_owner", orgStatus: "active", username: "boss", fullName: "이관리",
  isActive: true, mustChangePassword: false, staffType: "manager_staff", permissions: [],
};
const sampleAccounts = [
  {
    userId: "u1", username: "kim", fullName: "김직원", phone: "010", phoneSub: null,
    role: "staff", staffType: "manager_staff", affiliation: null, isActive: true, permissions: [], roleLabels: [],
  },
  {
    userId: "u2", username: "field", fullName: "박현장", phone: "011", phoneSub: null,
    role: "field", staffType: "field_staff", affiliation: null, isActive: true, permissions: [], roleLabels: [],
  },
  {
    userId: "u3", username: "support", fullName: "이청소", phone: "012", phoneSub: null,
    role: "staff", staffType: "support_staff", affiliation: null, isActive: true, permissions: [], roleLabels: [],
  },
  {
    userId: "u4", username: "tenant", fullName: "최입주", phone: "013", phoneSub: null,
    role: "tenant", staffType: "tenant", affiliation: null, isActive: true, permissions: [], roleLabels: [],
  },
];

function setup(me: MyContext = master) {
  vi.mocked(useMe).mockReturnValue({ data: me } as unknown as ReturnType<typeof useMe>);
  vi.mocked(useAccounts).mockReturnValue({ data: sampleAccounts, isLoading: false } as unknown as ReturnType<typeof useAccounts>);
  createMutateAsync.mockResolvedValue({ userId: "new-user" });
  basicMutateAsync.mockResolvedValue(undefined);
  permissionMutateAsync.mockResolvedValue(undefined);
  activeMutateAsync.mockResolvedValue(undefined);
  resetPasswordMutateAsync.mockResolvedValue(undefined);
  vi.mocked(useCreateAccount).mockReturnValue({ mutateAsync: createMutateAsync, isPending: false } as unknown as ReturnType<typeof useCreateAccount>);
  vi.mocked(useUpdateAccountBasic).mockReturnValue({ mutateAsync: basicMutateAsync, isPending: false } as unknown as ReturnType<typeof useUpdateAccountBasic>);
  vi.mocked(useUpdatePermissions).mockReturnValue({ mutateAsync: permissionMutateAsync, isPending: false } as unknown as ReturnType<typeof useUpdatePermissions>);
  vi.mocked(useSetActive).mockReturnValue({ mutateAsync: activeMutateAsync, isPending: false } as unknown as ReturnType<typeof useSetActive>);
  vi.mocked(useResetPassword).mockReturnValue({ mutateAsync: resetPasswordMutateAsync, isPending: false } as unknown as ReturnType<typeof useResetPassword>);
  vi.mocked(useResidentClaims).mockReturnValue({
    data: [{
      claimId: 31, orgId: 1, residentUserId: "resident-1", kakaoId: "unknown_2210",
      kakaoName: "윤소라", residentPhone: "010-6654-2210", claimedName: "윤소라",
      claimedPhone: "010-6654-2210", buildingId: 7, buildingName: "그린빌라",
      unitId: null, unitNo: null, claimedUnitText: "101", occupancyId: null,
      occupancyTenantName: null, occupancyPhone: null, status: "pending", kind: "manual",
      memo: null, createdAt: "2026-08-07T10:12:00.000Z", resolvedAt: null, resolvedBy: null,
    }],
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useResidentClaims>);
  approveClaimMutateAsync.mockResolvedValue(undefined);
  rejectClaimMutateAsync.mockResolvedValue(undefined);
  vi.mocked(useApproveResidentClaim).mockReturnValue({
    mutateAsync: approveClaimMutateAsync, isPending: false,
  } as unknown as ReturnType<typeof useApproveResidentClaim>);
  vi.mocked(useRejectResidentClaim).mockReturnValue({
    mutateAsync: rejectClaimMutateAsync, isPending: false,
  } as unknown as ReturnType<typeof useRejectResidentClaim>);
  vi.mocked(useOrgOccupancyLookup).mockReturnValue({
    data: [], isLoading: false, isError: false,
  } as unknown as ReturnType<typeof useOrgOccupancyLookup>);
}

beforeEach(() => { vi.clearAllMocks(); setup(); });

describe("AccountsPage", () => {
  it("3개 탭과 계정 목록 + 등록 버튼 렌더", () => {
    render(<AccountsPage />);
    expect(screen.getByRole("button", { name: "사무실 관리자" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "현장 관리자" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "입주자" })).toBeInTheDocument();
    expect(screen.getByText("김직원")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /계정 등록/ })).toBeInTheDocument();
  });

  it("관리자 탭은 staff_type을 필터링하고 입주자 탭은 청구 목록을 표시", () => {
    render(<AccountsPage />);

    expect(screen.getByText("김직원")).toBeInTheDocument();
    expect(screen.queryByText("박현장")).not.toBeInTheDocument();
    expect(screen.getByText("1개")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "현장 관리자" }));
    expect(screen.queryByText("김직원")).not.toBeInTheDocument();
    expect(screen.getByText("박현장")).toBeInTheDocument();
    expect(screen.getByText("이청소")).toBeInTheDocument();
    expect(screen.queryByText("최입주")).not.toBeInTheDocument();
    expect(screen.getByText("2개")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "입주자" }));
    expect(screen.queryByText("박현장")).not.toBeInTheDocument();
    expect(screen.queryByText("이청소")).not.toBeInTheDocument();
    expect(screen.queryByText("최입주")).not.toBeInTheDocument();
    expect(screen.getByText("unknown_2210")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "카카오 ID" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /계정 등록/ })).not.toBeInTheDocument();
    expect(screen.getByText("1개")).toBeInTheDocument();
  });

  it("+ 계정 등록 클릭 시 모달 오픈", async () => {
    render(<AccountsPage />);
    fireEvent.click(screen.getByRole("button", { name: /계정 등록/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "사무실 관리자 등록" })).toBeInTheDocument());
  });

  it("수정 모드에서 입력한 PIN을 reset mutation으로 전달", async () => {
    render(<AccountsPage />);
    fireEvent.click(screen.getByText("김직원"));
    await screen.findByRole("heading", { name: "사무실 관리자 수정" });

    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "4321" } });
    fireEvent.submit(screen.getByRole("button", { name: "저장" }).closest("form")!);

    await waitFor(() => expect(resetPasswordMutateAsync).toHaveBeenCalledWith({
      userId: "u1", password: "4321",
    }));
  });

  it("accounts 권한 없는 사용자는 권한없음 안내", () => {
    setup({ ...master, role: "staff", permissions: [] });
    render(<AccountsPage />);
    expect(screen.getByText(/권한이 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText("김직원")).toBeNull();
  });
});
