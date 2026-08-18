import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useMe: vi.fn(),
  useDashboardOverview: vi.fn(),
}));

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: mocks.useMe }));
vi.mock("@/hooks/reactquery/dashboard", () => ({
  getKoreaToday: () => "2026-08-18",
  useDashboardOverview: mocks.useDashboardOverview,
}));

import {
  DashboardContent,
  getMoveInDismissStorageKey,
} from "./DashboardContent";

const overview = {
  today: "2026-08-18",
  todayMoveIns: [
    {
      occupancyId: 31,
      buildingId: 1,
      buildingName: "그린빌라",
      unitId: 21,
      unitNo: "101호",
      dong: "A동",
      tenantName: "김입주",
      moveInDate: "2026-08-18",
    },
    {
      occupancyId: 32,
      buildingId: 2,
      buildingName: "새봄빌라",
      unitId: 22,
      unitNo: "202호",
      dong: null,
      tenantName: "이입주",
      moveInDate: "2026-08-18",
    },
  ],
  pendingComplaintCount: 4,
  overdueHouseholdCount: 3,
};

let refetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  refetch = vi.fn();
  mocks.useMe.mockReturnValue({
    data: { orgId: 7, username: "staff01" },
  });
  mocks.useDashboardOverview.mockReturnValue({
    data: overview,
    isPending: false,
    isError: false,
    refetch,
  });
});

describe("DashboardContent", () => {
  it("실데이터 카운트와 각 업무 화면 링크를 표시한다", () => {
    render(<DashboardContent />);

    const moveIn = screen.getByRole("link", { name: "오늘 입주예정 2세대 화면으로 이동" });
    const complaints = screen.getByRole("link", { name: "미처리 AS 4건 화면으로 이동" });
    const overdue = screen.getByRole("link", { name: "미납 세대 3세대 화면으로 이동" });

    expect(moveIn).toHaveAttribute("href", "/staff/buildings");
    expect(complaints).toHaveAttribute("href", "/staff/receipts");
    expect(overdue).toHaveAttribute("href", "/staff/overdue");
    expect(within(moveIn).getByText("2")).toBeInTheDocument();
    expect(within(complaints).getByText("4")).toBeInTheDocument();
    expect(within(overdue).getByText("3")).toBeInTheDocument();
  });

  it("요약 조회 중 로딩 인디케이터를 표시한다", () => {
    mocks.useDashboardOverview.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch,
    });

    render(<DashboardContent />);

    expect(screen.getByRole("status", { name: "업무 요약을 불러오는 중" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /오늘 입주예정/ })).not.toBeInTheDocument();
  });

  it("요약 조회 실패 시 PRD 오류 문구와 재시도를 제공한다", () => {
    mocks.useDashboardOverview.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });

    render(<DashboardContent />);
    expect(screen.getByRole("alert")).toHaveTextContent("오류가 발생했습니다. 다시 시도해 주세요.");
    fireEvent.click(screen.getByRole("button", { name: "재시도" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("첫 진입 시 입주예정 목록을 열고 실제 입주자 상세 경로로 연결한다", async () => {
    render(<DashboardContent />);

    const dialog = await screen.findByRole("dialog", { name: "오늘 입주예정 세대가 있습니다" });
    expect(within(dialog).getByText("입주예정 세대 2곳을 확인해 주세요. 행을 누르면 입주자 상세로 이동합니다.")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /그린빌라 A동 101호 김입주 2026.08.18/ }))
      .toHaveAttribute("href", "/staff/buildings/1/tenants/21");
  });

  it("닫기는 저장하지 않아 다음 진입 때 다시 표시한다", async () => {
    const first = render(<DashboardContent />);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    first.unmount();

    render(<DashboardContent />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("오늘 그만보기는 사용자·조직별로 당일 재노출을 억제한다", async () => {
    const first = render(<DashboardContent />);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "오늘 그만보기" }));

    expect(localStorage.getItem(getMoveInDismissStorageKey(7, "staff01"))).toBe("2026-08-18");
    first.unmount();
    render(<DashboardContent />);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("오늘 입주예정 세대가 없으면 팝업을 표시하지 않는다", async () => {
    mocks.useDashboardOverview.mockReturnValue({
      data: { ...overview, todayMoveIns: [] },
      isPending: false,
      isError: false,
      refetch,
    });

    render(<DashboardContent />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
