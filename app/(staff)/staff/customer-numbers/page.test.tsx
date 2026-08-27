import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/buildingCustomerNumbers", () => ({
  useCustomerNumberLookup: vi.fn(),
}));

import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useCustomerNumberLookup } from "@/hooks/reactquery/buildingCustomerNumbers";
import CustomerNumberLookupPage from "./page";

const buildings = [
  { id: 11, orgId: 9, code: "A", name: "해오름빌" },
  { id: 12, orgId: 9, code: "B", name: "푸른빌딩" },
];

const rows = [
  {
    id: 1,
    buildingId: 11,
    buildingName: "해오름빌",
    kind: "water" as const,
    customerNo: "W-1001",
    holderName: "김명의",
    meterDay: 15,
    billingBasis: "prev" as const,
    printOnBill: true,
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
  vi.mocked(useMe).mockReturnValue({
    data: { orgId: 9, role: "staff", permissions: ["buildings"] },
  } as never);
  vi.mocked(useBuildings).mockReturnValue({
    data: buildings,
    isLoading: false,
    isError: false,
    refetch,
  } as never);
  setupLookup();
});

describe("CustomerNumberLookupPage", () => {
  it("유형 필터 변경을 고객번호 조회 조건에 반영한다", async () => {
    render(<CustomerNumberLookupPage />);

    fireEvent.change(screen.getByLabelText("유형 필터"), {
      target: { value: "common_elec" },
    });

    await waitFor(() =>
      expect(useCustomerNumberLookup).toHaveBeenLastCalledWith({
        buildingId: null,
        kind: "common_elec",
        q: "",
        page: 1,
        pageSize: 50,
      }),
    );
  });

  it("조회 중에는 로딩 상태를 표시한다", () => {
    setupLookup({ data: [], isLoading: true });

    render(<CustomerNumberLookupPage />);

    expect(screen.getByRole("status", { name: "고객번호 조회 중" })).toBeInTheDocument();
  });

  it("조회 결과가 없으면 빈 상태를 표시한다", () => {
    setupLookup({ data: [] });

    render(<CustomerNumberLookupPage />);

    expect(screen.getByText("조건에 맞는 고객번호가 없습니다")).toBeInTheDocument();
  });

  it("엑셀 다운로드에 현재 건물·유형·검색 필터를 직렬화한다", () => {
    vi.useFakeTimers();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    try {
      render(<CustomerNumberLookupPage />);
      fireEvent.change(screen.getByLabelText("건물 필터"), {
        target: { value: "11" },
      });
      fireEvent.change(screen.getByLabelText("유형 필터"), {
        target: { value: "gas" },
      });
      fireEvent.change(screen.getByLabelText("고객번호 또는 명의자 검색"), {
        target: { value: " 김 명의 " },
      });
      act(() => vi.advanceTimersByTime(300));

      fireEvent.click(screen.getByRole("button", { name: "엑셀 다운로드" }));

      expect(click).toHaveBeenCalledTimes(1);
      const anchor = click.mock.instances[0] as HTMLAnchorElement;
      expect(anchor.getAttribute("href")).toBe(
        "/api/customer-numbers/export?buildingId=11&kind=gas&q=%EA%B9%80+%EB%AA%85%EC%9D%98",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
