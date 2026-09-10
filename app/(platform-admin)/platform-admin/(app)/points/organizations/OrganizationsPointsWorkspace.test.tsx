import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  usePlatformTransactions: vi.fn(),
  usePointReservations: vi.fn(),
  useChargePoints: vi.fn(),
  useAdjustPoints: vi.fn(),
  useReleaseStalePointReservation: vi.fn(),
  listPlatformOrganizations: vi.fn(),
  orgRefetch: vi.fn(),
  modalOrgRefetch: vi.fn(),
  transactionRefetch: vi.fn(),
  reservationRefetch: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: mocks.useQuery };
});
vi.mock("@/hooks/reactquery/platform", () => ({
  listPlatformOrganizations: mocks.listPlatformOrganizations,
  platformKeys: {
    organizations: (query: {
      search?: string;
      page?: number;
      pageSize?: number;
    }) => ["platform-admin", "organizations", query.search ?? "", query.page ?? 1, query.pageSize ?? 25],
  },
  useAdjustPoints: mocks.useAdjustPoints,
  usePlatformTransactions: mocks.usePlatformTransactions,
  usePointReservations: mocks.usePointReservations,
  useChargePoints: mocks.useChargePoints,
  useReleaseStalePointReservation: mocks.useReleaseStalePointReservation,
}));

import { OrganizationsPointsWorkspace } from "./OrganizationsPointsWorkspace";

const organization = {
  id: 7,
  name: "한빛관리",
  status: "active",
  ledgerBalance: 1200,
  reservedPoints: 200,
  availablePoints: 1000,
  deletedAt: null,
};

const orgsQuery = {
  data: { rows: [organization], totalCount: 30, page: 1, pageSize: 25 },
  isPending: false,
  isError: false,
  refetch: mocks.orgRefetch,
};
const modalOrgsQuery = {
  data: { rows: [organization], totalCount: 1, page: 1, pageSize: 100 },
  isPending: false,
  isError: false,
  refetch: mocks.modalOrgRefetch,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useQuery.mockImplementation((options: { queryKey: readonly unknown[] }) =>
    options.queryKey.at(-1) === 100 ? modalOrgsQuery : orgsQuery,
  );
  mocks.usePlatformTransactions.mockReturnValue({
    data: { pages: [{ rows: [], totalCount: 0 }] },
    isPending: false,
    isError: false,
    refetch: mocks.transactionRefetch,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  });
  mocks.usePointReservations.mockReturnValue({
    data: {
      rows: [],
      totalCount: 0,
      page: 1,
      pageSize: 25,
      hasReconcileRequired: false,
    },
    isPending: false,
    isError: false,
    refetch: mocks.reservationRefetch,
  });
  const mutation = { mutateAsync: vi.fn(), isPending: false };
  mocks.useChargePoints.mockReturnValue(mutation);
  mocks.useAdjustPoints.mockReturnValue(mutation);
  mocks.useReleaseStalePointReservation.mockReturnValue(mutation);
});

describe("OrganizationsPointsWorkspace", () => {
  it("조직별 잔액과 기존 빈 상태들을 렌더한다", () => {
    render(<OrganizationsPointsWorkspace />);

    expect(screen.getByRole("heading", { name: "조직별 포인트 잔액" })).toBeInTheDocument();
    expect(screen.getByText("한빛관리")).toBeInTheDocument();
    expect(screen.getByText("1,200 P")).toBeInTheDocument();
    expect(screen.getByText("활성 예약이 없습니다")).toBeInTheDocument();
    expect(screen.getByText("내역이 없습니다")).toBeInTheDocument();
  });

  it("조직 Query 오류 UI에서 다시 조회한다", () => {
    mocks.useQuery.mockImplementation((options: { queryKey: readonly unknown[] }) =>
      options.queryKey.at(-1) === 100
        ? modalOrgsQuery
        : { ...orgsQuery, data: undefined, isError: true },
    );

    render(<OrganizationsPointsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(mocks.orgRefetch).toHaveBeenCalledOnce();
  });

  it("조직 페이지네이션을 Client state로 변경한다", () => {
    render(<OrganizationsPointsWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(["organizations", 2, 25]),
      }),
    );
  });
});
