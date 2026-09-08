import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/movingSettlement", () => ({
  useSettlementInquiry: vi.fn(),
  useUpdateSettlementInquiryRows: vi.fn(),
}));

import { useMe } from "@/hooks/reactquery/auth";
import {
  useSettlementInquiry,
  useUpdateSettlementInquiryRows,
} from "@/hooks/reactquery/movingSettlement";
import { AllSettlementInquiryPage } from "./AllSettlementInquiryPage";

const mutate = vi.fn();
const row = {
  settlementId: 31,
  buildingId: 3,
  buildingCode: "B003",
  buildingName: "광원타운",
  buildingAddress: "용전동",
  unitId: 101,
  occupancyId: 9,
  dong: null,
  unitNo: "404",
  tenantName: "홍길동",
  status: "completed" as const,
  moveOutDate: "2026-04-16",
  moveInDate: "2025-10-25",
  mgmtFeeProrated: 93320,
  waterCharge: null,
  elecCharge: 4550,
  gasCharge: 980,
  elecPreviousReading: 767,
  elecCurrentReading: 802,
  elecUsage: 35,
  gasPreviousReading: 383,
  gasCurrentReading: 384,
  gasUsage: 1,
  elecPaidDate: null,
  gasPaidDate: null,
  repairAmount: null,
  cleaningCost: null,
  checkedByName: "박세진",
  settlementAmount: 98850,
  processedAt: "2026-04-16T03:00:00Z",
  createdAt: "2026-04-16T01:00:00Z",
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

describe("AllSettlementInquiryPage", () => {
  it("Figma 통합표의 조회 도구와 전기·가스 열, 건물 소계를 표시한다", () => {
    render(<AllSettlementInquiryPage />);

    expect(screen.getByLabelText("조회 시작 연도")).toBeInTheDocument();
    expect(screen.getByLabelText("건물명·소재지 검색")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "출력" })).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "전기검침" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "가스이주" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "청소비용" })).toBeInTheDocument();
    expect(within(table).getAllByText("광원타운")).toHaveLength(2);
    expect(within(table).getByText("완결")).toBeInTheDocument();
    expect(within(table).getByText("합계 1건")).toBeInTheDocument();
  });

  it("완결 필터를 즉시 조회에 반영한다", async () => {
    render(<AllSettlementInquiryPage />);

    fireEvent.click(screen.getByRole("button", { name: "완결" }));

    await waitFor(() => {
      expect(useSettlementInquiry).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "completed", sort: "code" }),
      );
    });
  });

  it("입금일과 청소비 변경 행만 저장한다", () => {
    render(<AllSettlementInquiryPage />);

    fireEvent.change(screen.getByLabelText("광원타운 404 전기 입금일자"), {
      target: { value: "2026-04-20" },
    });
    fireEvent.change(screen.getByLabelText("광원타운 404 청소비용"), {
      target: { value: "69,000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(mutate).toHaveBeenCalledWith(
      [{
        settlementId: 31,
        elecPaidDate: "2026-04-20",
        gasPaidDate: null,
        cleaningCost: 69000,
      }],
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
