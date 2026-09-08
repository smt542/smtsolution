import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Building } from "@/hooks/reactquery/buildings";
import type { PaymentRow, UnitPayment } from "@/hooks/reactquery/payments";
import { PaymentReceiptPrintView } from "./PaymentReceiptPrintView";

const building = {
  id: 1,
  orgId: 7,
  code: "001",
  name: "그린빌라",
  address: "서울시 강남구",
} as Building;

const row = {
  unitId: 11,
  unitNo: "101호",
  dong: "A동",
  tenantName: "김세대",
  charged: 100_000,
} as PaymentRow;

const payment: UnitPayment = {
  id: 31,
  amount: 60_000,
  fee: 0,
  method: "transfer",
  kind: "partial",
  memo: "입금 확인",
  paidAt: "2026-08-15",
  status: "active",
  createdAt: "2026-08-15T09:00:00Z",
};

describe("PaymentReceiptPrintView", () => {
  it("수납일·세대·금액·구분·수납자와 회사 워터마크를 출력한다", () => {
    render(
      <PaymentReceiptPrintView
        building={building}
        companyName="한빛관리"
        row={row}
        payment={payment}
        period="2026-08-01"
        lateFee={5_000}
        receiverName="이관리"
      />,
    );

    expect(screen.getByRole("heading", { name: "관리비 수납 영수증" })).toBeInTheDocument();
    expect(screen.getByText("A동 101호")).toBeInTheDocument();
    expect(screen.getByText("2026-08-15")).toBeInTheDocument();
    expect(screen.getByText("계좌이체")).toBeInTheDocument();
    expect(screen.getByText("분할")).toBeInTheDocument();
    expect(screen.getByText("이관리")).toBeInTheDocument();
    expect(screen.getAllByText("한빛관리").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("60,000원").length).toBeGreaterThanOrEqual(2);
  });
});
