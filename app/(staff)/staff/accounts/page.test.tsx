import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/hooks/reactquery/accounts", () => ({
  useAccounts: vi.fn(), useCreateAccount: vi.fn(), useUpdateAccountBasic: vi.fn(),
  useUpdatePermissions: vi.fn(), useSetActive: vi.fn(), useResetPassword: vi.fn(),
}));
vi.mock("@/hooks/reactquery/staffRoles", () => ({ useStaffRoles: vi.fn() }));
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import AccountsPage from "./page";
import {
  useAccounts, useCreateAccount, useUpdateAccountBasic, useUpdatePermissions, useSetActive, useResetPassword,
} from "@/hooks/reactquery/accounts";
import { useStaffRoles } from "@/hooks/reactquery/staffRoles";
import { useMe, type MyContext } from "@/hooks/reactquery/auth";

const mutate = { mutateAsync: vi.fn(), isPending: false };
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
  vi.mocked(useStaffRoles).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useStaffRoles>);
  vi.mocked(useCreateAccount).mockReturnValue(mutate as unknown as ReturnType<typeof useCreateAccount>);
  vi.mocked(useUpdateAccountBasic).mockReturnValue(mutate as unknown as ReturnType<typeof useUpdateAccountBasic>);
  vi.mocked(useUpdatePermissions).mockReturnValue(mutate as unknown as ReturnType<typeof useUpdatePermissions>);
  vi.mocked(useSetActive).mockReturnValue(mutate as unknown as ReturnType<typeof useSetActive>);
  vi.mocked(useResetPassword).mockReturnValue(mutate as unknown as ReturnType<typeof useResetPassword>);
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

  it("탭별 staff_type을 정확히 필터링", () => {
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
    expect(screen.getByText("최입주")).toBeInTheDocument();
    expect(screen.getByText("1개")).toBeInTheDocument();
  });

  it("+ 계정 등록 클릭 시 모달 오픈", async () => {
    render(<AccountsPage />);
    fireEvent.click(screen.getByRole("button", { name: /계정 등록/ }));
    await waitFor(() => expect(screen.getByText("계정 등록", { selector: "h2, h3" })).toBeInTheDocument());
  });

  it("accounts 권한 없는 사용자는 권한없음 안내", () => {
    setup({ ...master, role: "staff", permissions: [] });
    render(<AccountsPage />);
    expect(screen.getByText(/권한이 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText("김직원")).toBeNull();
  });
});
