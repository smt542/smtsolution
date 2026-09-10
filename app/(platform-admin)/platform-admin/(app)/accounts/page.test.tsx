import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  refetch: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));
vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: Symbol("keepPreviousData"),
  useQuery: mocks.useQuery,
}));
vi.mock("@/hooks/reactquery/platform", () => ({
  listPlatformAccounts: vi.fn(),
  platformKeys: {
    accounts: (query: unknown) => ["platform", "accounts", query],
  },
  useCreatePlatformAccount: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
  usePlatformUpdateAccount: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
  usePlatformUpdateRole: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
  usePlatformSetActive: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
  usePlatformResetPassword: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import PlatformAccountsPage from "./page";

const account = {
  orgId: 3,
  organizationName: "한빛관리",
  userId: "user-1",
  username: "manager1",
  fullName: "김관리",
  phone: "010-1234-5678",
  memo: "총괄 담당",
  role: "manager",
  staffType: "manager_staff",
  permissions: ["buildings"],
  isActive: true,
  createdAt: "2026-08-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useQuery.mockReturnValue({
    data: { rows: [account], totalCount: 1, page: 1, pageSize: 25 },
    isPending: false,
    isError: false,
    refetch: mocks.refetch,
  });
});

describe("PlatformAccountsPage", () => {
  it("Server page 아래 Client workspace에서 계정 목록을 표시한다", () => {
    render(<PlatformAccountsPage />);

    expect(screen.getByText("김관리")).toBeInTheDocument();
    expect(screen.getByText("한빛관리")).toBeInTheDocument();
    expect(screen.getByText("총괄 담당")).toBeInTheDocument();
    expect(screen.getByText("활성")).toBeInTheDocument();
    expect(screen.getByText("총 1개")).toBeInTheDocument();
  });

  it("Query 오류 시 기존 다시 시도 동작을 유지한다", () => {
    mocks.useQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: mocks.refetch,
    });

    render(<PlatformAccountsPage />);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(screen.getByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
});
