import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  PaymentStatementPrintView,
  type PaymentStatementRow,
} from "./PaymentStatementPrintView";
import { paymentPeriods } from "./PaymentStatementModal";

const building = {
  id: 1,
  orgId: 7,
  code: "001",
  name: "그린빌라",
  address: "서울시 강남구",
} as Building;

const row: PaymentStatementRow = {
  key: "2026-08-01:11",
  period: "2026-08-01",
  unitNo: "101호",
  dong: "A동",
  tenantName: "김세대",
  paymentDates: ["2026-08-15"],
  charged: 100_000,
  lateFee: 5_000,
  paid: 60_000,
  unpaid: 40_000,
  utilities: {
    electricity: { amount: 10_000, previousReading: 100, currentReading: 120, usage: 20, unitPrice: 500 },
    water: { amount: 8_000, previousReading: 30, currentReading: 34, usage: 4, unitPrice: 2_000 },
    gas: { amount: 7_000, previousReading: 20, currentReading: 22, usage: 2, unitPrice: 3_500 },
  },
};

describe("PaymentStatementPrintView", () => {
  it("시작월부터 종료월까지 월초 기간을 만든다", () => {
    expect(paymentPeriods("2026-06", "2026-08")).toEqual([
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
    ]);
  });

  it("기간·세대별 수납과 공과금 지침·단가·합계·워터마크를 출력한다", () => {
    render(
      <PaymentStatementPrintView
        building={building}
        companyName="한빛관리"
        startPeriod="2026-08-01"
        endPeriod="2026-08-01"
        scopeLabel="A동 101호"
        utilityTypes={["electricity", "water", "gas"]}
        rows={[row]}
      />,
    );

    expect(screen.getByRole("heading", { name: "수납명세서" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "당월계" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "연체료" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "금월지침" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "단가" })).toBeInTheDocument();
    expect(screen.getByText("수납액 합계")).toBeInTheDocument();
    expect(screen.getAllByText("한빛관리").length).toBeGreaterThanOrEqual(2);
  });

  it("출력할 행이 없으면 결과 없음 안내를 표시한다", () => {
    render(
      <PaymentStatementPrintView
        building={building}
        companyName="한빛관리"
        startPeriod="2026-08-01"
        endPeriod="2026-08-01"
        scopeLabel="건물 전체"
        utilityTypes={[]}
        rows={[]}
      />,
    );

    expect(screen.getByText("검색 결과가 없습니다.")).toBeInTheDocument();
  });
});
