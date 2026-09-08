import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildingCustomerNumbers", () => ({
  useCustomerNumberLookup: vi.fn(),
}));

import { useMe } from "@/hooks/reactquery/auth";
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
  vi.mocked(useMe).mockReturnValue({
    data: { orgId: 9, role: "staff", permissions: ["utilities"] },
  } as never);
  setupLookup();
});

describe("CustomerNumberLookupPage", () => {
  it("수도와 공용전기를 전환해 조회한다", async () => {
    render(<CustomerNumberLookupPage />);
    fireEvent.click(screen.getByRole("button", { name: "공용전기" }));

    await waitFor(() =>
      expect(useCustomerNumberLookup).toHaveBeenLastCalledWith({
        kind: "common_elec",
        q: "",
        page: 1,
        pageSize: 50,
      }),
    );
    expect(screen.getByRole("button", { name: "공용전기" })).toHaveAttribute("aria-pressed", "true");
  });

  it("조회 중에는 로딩 상태를 표시한다", () => {
    setupLookup({ data: [], isLoading: true });
    render(<CustomerNumberLookupPage />);
    expect(screen.getByRole("status", { name: "고객번호 조회 중" })).toBeInTheDocument();
  });

  it("조회 결과가 없으면 빈 상태를 표시한다", () => {
    setupLookup({ data: [] });
    render(<CustomerNumberLookupPage />);
    expect(screen.getByText("검색 결과가 없습니다")).toBeInTheDocument();
  });

  it("엑셀 다운로드에 현재 유형과 검색어를 직렬화한다", () => {
    vi.useFakeTimers();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    try {
      render(<CustomerNumberLookupPage />);
      fireEvent.click(screen.getByRole("button", { name: "공용전기" }));
      fireEvent.change(screen.getByLabelText("고객번호 통합검색"), {
        target: { value: " 강남 빌라 " },
      });
      act(() => vi.advanceTimersByTime(300));
      fireEvent.click(screen.getByRole("button", { name: "엑셀 다운로드" }));

      const anchor = click.mock.instances[0] as HTMLAnchorElement;
      expect(anchor.getAttribute("href")).toBe(
        "/api/customer-numbers/export?kind=common_elec&q=%EA%B0%95%EB%82%A8+%EB%B9%8C%EB%9D%BC",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
