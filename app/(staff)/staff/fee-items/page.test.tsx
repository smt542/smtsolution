import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildingTypes", () => ({ useBuildingTypes: vi.fn() }));
vi.mock("@/hooks/reactquery/feeItems", () => ({ useFeeItemLookup: vi.fn() }));

import { useMe } from "@/hooks/reactquery/auth";
import { useBuildingTypes } from "@/hooks/reactquery/buildingTypes";
import { useFeeItemLookup } from "@/hooks/reactquery/feeItems";
import FeeItemLookupPage from "./page";

const buildingTypes = [
  { id: 7, orgId: 9, label: "원룸텔", sortOrder: 0 },
];

const rows = [
  {
    id: 1,
    typeId: 7,
    typeLabel: "원룸텔",
    name: "일반관리비",
    rounding: "round",
    dailyProration: true,
    carryOver: false,
    isRequired: true,
    sortOrder: 0,
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
  vi.mocked(useFeeItemLookup).mockReturnValue({
    data: { rows: data, total: data.length },
    isLoading,
    isError,
    refetch,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useMe).mockReturnValue({
    data: { orgId: 9, role: "staff", permissions: ["billing"] },
  } as never);
  vi.mocked(useBuildingTypes).mockReturnValue({
    data: buildingTypes,
    isLoading: false,
    isError: false,
    refetch,
  } as never);
  setupLookup();
});

describe("FeeItemLookupPage", () => {
  it("applies required selection to the fee-item lookup filters", async () => {
    render(<FeeItemLookupPage />);

    fireEvent.change(screen.getByLabelText("필수여부 필터"), {
      target: { value: "false" },
    });

    await waitFor(() =>
      expect(useFeeItemLookup).toHaveBeenLastCalledWith({
        typeId: null,
        required: false,
        q: "",
        page: 1,
        pageSize: 50,
      }),
    );
  });

  it("shows a loading state while the lookup is pending", () => {
    setupLookup({ data: [], isLoading: true });

    render(<FeeItemLookupPage />);

    expect(screen.getByRole("status", { name: "관리비 항목 조회 중" })).toBeInTheDocument();
  });

  it("shows an empty state when the lookup has no rows", () => {
    setupLookup({ data: [] });

    render(<FeeItemLookupPage />);

    expect(screen.getByText("조건에 맞는 관리비 항목이 없습니다")).toBeInTheDocument();
  });

  it("serializes type, required, and debounced text filters for export", () => {
    vi.useFakeTimers();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    try {
      render(<FeeItemLookupPage />);
      fireEvent.change(screen.getByLabelText("건물유형 필터"), {
        target: { value: "7" },
      });
      fireEvent.change(screen.getByLabelText("필수여부 필터"), {
        target: { value: "false" },
      });
      fireEvent.change(screen.getByLabelText("항목명 검색"), {
        target: { value: " 일반 관리 " },
      });
      act(() => vi.advanceTimersByTime(300));

      fireEvent.click(screen.getByRole("button", { name: "엑셀 다운로드" }));

      expect(click).toHaveBeenCalledTimes(1);
      const anchor = click.mock.instances[0] as HTMLAnchorElement;
      expect(anchor.getAttribute("href")).toBe(
        "/api/fee-items/export?typeId=7&required=false&q=%EC%9D%BC%EB%B0%98+%EA%B4%80%EB%A6%AC",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the permission empty state without billing access", () => {
    vi.mocked(useMe).mockReturnValue({
      data: { orgId: 9, role: "staff", permissions: [] },
    } as never);

    render(<FeeItemLookupPage />);

    expect(screen.getByText("권한이 없습니다")).toBeInTheDocument();
  });
});
