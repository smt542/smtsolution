import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStaffContext: vi.fn(),
}));

vi.mock("../_staffContext", () => ({ getStaffContext: mocks.getStaffContext }));
vi.mock("@/hooks/reactquery/buildingCustomerNumbers", () => ({
  useCustomerNumberLookup: vi.fn(),
}));

import { useCustomerNumberLookup } from "@/hooks/reactquery/buildingCustomerNumbers";
import CustomerNumberLookupPage from "./page";

const rows = [
  {
    id: 1,
    buildingId: 11,
    buildingCode: "B0011",
    buildingName: "해오름빌라",
    address: "서울시 강남구",
    kind: "water" as const,
    customerNo: "W-1001",
    lineName: "1",
    meterDay: 15,
    billingBasis: "prev" as const,
    calculationMethod: "auto" as const,
    note: "옥상 수도",
  },
];
const refetch = vi.fn();

function setupLookup({
  data = rows,
  isLoading = false,
  isError = false,
}: {
  data?: typeof rows;
  isLoading?: boolean;
  isError?: boolean;
} = {}) {
  vi.mocked(useCustomerNumberLookup).mockReturnValue({
    data: { rows: data, total: data.length },
    isLoading,
    isError,
    refetch,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStaffContext.mockResolvedValue({ orgId: 9, role: "staff", permissions: ["utilities"] });
  setupLookup();
});

describe("CustomerNumberLookupPage", () => {
  it("수도와 공용전기를 전환해 조회한다", async () => {
    render(await CustomerNumberLookupPage());
    fireEvent.click(screen.getByRole("button", { name: "공용전기" }));

    await waitFor(() =>
      expect(useCustomerNumberLookup).toHaveBeenLastCalledWith({
        kind: "common_elec",
        page: 1,
        pageSize: 50,
      }),
    );
    expect(screen.getByRole("button", { name: "공용전기" })).toHaveAttribute("aria-pressed", "true");
  });

  it("조회 중에는 로딩 상태를 표시한다", async () => {
    setupLookup({ data: [], isLoading: true });
    render(await CustomerNumberLookupPage());
    expect(screen.getByRole("status", { name: "고객번호 조회 중" })).toBeInTheDocument();
  });

  it("조회 결과가 없으면 빈 상태를 표시한다", async () => {
    setupLookup({ data: [] });
    render(await CustomerNumberLookupPage());
    expect(screen.getByText("검색 결과가 없어요")).toBeInTheDocument();
    expect(screen.getByText("고객번호나 건물명으로 다시 검색해 주세요")).toBeInTheDocument();
  });

  it("원본 패널 헤더처럼 유형 세그먼트와 건수만 표시한다", async () => {
    render(await CustomerNumberLookupPage());

    expect(screen.getByRole("group", { name: "공과금 종류" })).toBeInTheDocument();
    expect(screen.getByLabelText("조회 결과 1건")).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "엑셀 다운로드" })).not.toBeInTheDocument();
  });
});
