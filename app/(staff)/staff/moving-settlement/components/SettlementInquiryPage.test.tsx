import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/bill", () => ({
  useBillOrganizationName: () => ({ data: "한빛관리" }),
}));
vi.mock("@/hooks/reactquery/movingSettlement", () => ({
  useSettlementInquiry: vi.fn(),
  useUpdateSettlementInquiryRows: vi.fn(),
}));

import { useMe } from "@/hooks/reactquery/auth";
import {
  useUpdateSettlementInquiryRows,
  useSettlementInquiry,
} from "@/hooks/reactquery/movingSettlement";
import { SettlementInquiryPage } from "./SettlementInquiryPage";

const mutate = vi.fn();
const row = {
  settlementId: 31,
  buildingId: 3,
  buildingCode: "B-003",
  buildingAddress: "부산 남구 수영로 12",
  buildingName: "해오름",
  unitId: 101,
  occupancyId: 9,
  dong: "A동",
  unitNo: "101호",
  tenantName: "홍길동",
  moveInDate: "2025-08-01",
  status: "completed" as const,
  moveOutDate: "2026-08-13",
  mgmtFeeProrated: 125806,
  waterCharge: 12000,
  elecPreviousReading: 136,
  elecCurrentReading: 172,
  elecUsage: 36,
  elecCharge: 23000,
  elecPaidDate: "2026-08-12",
  gasPreviousReading: 50,
  gasCurrentReading: 61,
  gasUsage: 11,
  gasCharge: 8000,
  gasPaidDate: null,
  repairAmount: 50000,
  checkedByName: "박검침",
  cleaningCost: 30000,
  settlementAmount: 218806,
  processedAt: "2026-08-13T03:00:00Z",
  createdAt: "2026-08-13T01:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useMe).mockReturnValue({
    data: { role: "staff", permissions: ["moving"] },
  } as never);
  vi.mocked(useSettlementInquiry).mockReturnValue({
    data: { rows: [row], total: 1 },
    isLoading: false,
    error: null,
  } as never);
  vi.mocked(useUpdateSettlementInquiryRows).mockReturnValue({
    mutate,
    isPending: false,
  } as never);
});

describe("SettlementInquiryPage", () => {
  it("전체 조회 화면에 Figma 통합표와 건물별 소계를 표시한다", () => {
    render(<SettlementInquiryPage type="all" />);

    expect(screen.getByRole("region", { name: "전체 이사조회" })).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "소재지" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "전기검침" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "가스검침" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "청소비용" })).toBeInTheDocument();
    expect(within(table).getAllByText("부산 남구 수영로 12")).toHaveLength(2);
    expect(within(table).getAllByText("해오름")).toHaveLength(2);
    expect(within(table).getByText("박검침")).toBeInTheDocument();
    expect(within(table).getByText("완결")).toBeInTheDocument();
    expect(screen.getByTestId("settlement-inquiry-print-header")).toHaveTextContent("한빛관리");
  });

  it("전기 조회 화면에서는 전기요금 열만 표시한다", () => {
    render(<SettlementInquiryPage type="electric" />);

    expect(screen.getByRole("region", { name: "전기 이사조회" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "전기요금" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "수도요금" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "가스요금" })).not.toBeInTheDocument();
  });

  it("상태·정렬·검색 조건을 별도 조회 버튼 없이 즉시 반영한다", async () => {
    render(<SettlementInquiryPage type="water" />);

    fireEvent.click(within(screen.getByRole("group", { name: "정산 상태" }))
      .getByRole("button", { name: "미결" }));
    fireEvent.click(within(screen.getByRole("group", { name: "정렬" }))
      .getByRole("button", { name: "일자순" }));
    fireEvent.change(screen.getByLabelText("건물명·소재지 검색"), {
      target: { value: "해오름" },
    });

    await waitFor(() => {
      expect(useSettlementInquiry).toHaveBeenLastCalledWith(expect.objectContaining({
        type: "water",
        search: "해오름",
        status: "incomplete",
        sort: "date",
        page: 1,
        pageSize: 100,
      }));
    });
  });

  it("인라인에서 비운 입금일과 수정한 청소비를 한 번에 저장한다", () => {
    render(<SettlementInquiryPage type="all" />);

    fireEvent.change(screen.getByLabelText("해오름 101호 전기 입금일자"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("해오름 101호 청소비용"), {
      target: { value: "35000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(mutate).toHaveBeenCalledWith([{
      settlementId: 31,
      elecPaidDate: null,
      gasPaidDate: null,
      cleaningCost: 35000,
    }], expect.objectContaining({
      onSuccess: expect.any(Function),
      onError: expect.any(Function),
    }));
  });

  it("편집값을 원래 값으로 되돌리면 저장 대상에서 제외한다", () => {
    render(<SettlementInquiryPage type="all" />);

    const cleaningCost = screen.getByLabelText("해오름 101호 청소비용");
    fireEvent.change(cleaningCost, { target: { value: "35000" } });
    fireEvent.change(cleaningCost, { target: { value: "30000" } });

    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("moving 권한이 없으면 접근 거부를 표시한다", () => {
    vi.mocked(useMe).mockReturnValue({
      data: { role: "staff", permissions: [] },
    } as never);

    render(<SettlementInquiryPage type="gas" />);

    expect(screen.getByText("이 화면에 접근할 권한이 없습니다. (이사정산 권한 필요)"))
      .toBeInTheDocument();
  });
});
