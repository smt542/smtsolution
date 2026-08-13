import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/movingSettlement", () => ({
  useSettlementInquiry: vi.fn(),
}));

import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useSettlementInquiry } from "@/hooks/reactquery/movingSettlement";
import { SettlementInquiryPage } from "./SettlementInquiryPage";

const row = {
  settlementId: 31,
  buildingId: 3,
  buildingName: "해오름",
  unitId: 101,
  occupancyId: 9,
  dong: "A동",
  unitNo: "101호",
  tenantName: "홍길동",
  status: "completed" as const,
  moveOutDate: "2026-08-13",
  mgmtFeeProrated: 125806,
  waterCharge: 12000,
  elecCharge: 23000,
  gasCharge: 8000,
  elecPaidDate: "2026-08-12",
  gasPaidDate: null,
  repairAmount: 50000,
  settlementAmount: 218806,
  processedAt: "2026-08-13T03:00:00Z",
  createdAt: "2026-08-13T01:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useMe).mockReturnValue({
    data: { role: "staff", permissions: ["moving"] },
  } as never);
  vi.mocked(useBuildings).mockReturnValue({
    data: [{ id: 3, name: "해오름" }],
    isLoading: false,
    error: null,
  } as never);
  vi.mocked(useSettlementInquiry).mockReturnValue({
    data: { rows: [row], total: 27 },
    isLoading: false,
    error: null,
  } as never);
});

describe("SettlementInquiryPage", () => {
  it("전체 조회 화면에서 4개 경로와 공통·유형별 금액을 표시한다", () => {
    render(<SettlementInquiryPage type="all" />);

    expect(screen.getByRole("heading", { name: "전체 이사조회" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "수도" })).toHaveAttribute(
      "href",
      "/staff/moving-settlement/inquiries/water",
    );
    expect(screen.getByRole("link", { name: "전기" })).toHaveAttribute(
      "href",
      "/staff/moving-settlement/inquiries/electric",
    );
    expect(screen.getByRole("link", { name: "가스" })).toHaveAttribute(
      "href",
      "/staff/moving-settlement/inquiries/gas",
    );
    expect(screen.getByRole("link", { name: "전체" })).toHaveAttribute(
      "href",
      "/staff/moving-settlement/inquiries/all",
    );

    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "수도요금" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "전기요금" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "가스요금" })).toBeInTheDocument();
    expect(within(table).getByText("해오름")).toBeInTheDocument();
    expect(within(table).getByText("12,000원")).toBeInTheDocument();
    expect(within(table).getByText("23,000원")).toBeInTheDocument();
    expect(within(table).getByText("8,000원")).toBeInTheDocument();
  });

  it("전기 조회 화면에서는 전기요금 열만 표시한다", () => {
    render(<SettlementInquiryPage type="electric" />);

    expect(screen.getByRole("heading", { name: "전기 이사조회" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "전기요금" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "수도요금" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "가스요금" })).not.toBeInTheDocument();
  });

  it("조회 조건과 다음 페이지를 쿼리에 반영한다", async () => {
    render(<SettlementInquiryPage type="water" />);

    fireEvent.change(screen.getByLabelText("건물"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("조회 시작일"), {
      target: { value: "2026-07-01" },
    });
    fireEvent.change(screen.getByLabelText("조회 종료일"), {
      target: { value: "2026-07-31" },
    });
    fireEvent.change(screen.getByLabelText("검색어"), {
      target: { value: "홍길동" },
    });
    fireEvent.change(screen.getByLabelText("상태"), {
      target: { value: "completed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "조회" }));

    await waitFor(() => {
      expect(useSettlementInquiry).toHaveBeenLastCalledWith({
        type: "water",
        buildingId: 3,
        from: "2026-07-01",
        to: "2026-07-31",
        search: "홍길동",
        status: "completed",
        page: 1,
        pageSize: 20,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => {
      expect(useSettlementInquiry).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });
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
