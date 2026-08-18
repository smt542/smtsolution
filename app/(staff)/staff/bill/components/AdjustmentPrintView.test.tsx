import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdjustmentPrintView, type AdjustmentBuildingDocuments } from "./AdjustmentPrintView";

const commonDocument = {
  unitId: 11, unitNo: "101", dong: null, tenantName: "홍길동", autoDebit: true,
  billingNote: null, unitNotice: null,
};
const bundle = {
  building: { id: 7, orgId: 1, code: "B007", name: "행복빌라", address: "서울시" },
  current: [{ ...commonDocument, totalAmount: 38000, items: [{ feeItemId: 1, name: "수도", charged: true, amount: 8000 }] }],
  previous: [{ ...commonDocument, totalAmount: 35000, items: [{ feeItemId: 1, name: "수도", charged: true, amount: 5000 }] }],
  targets: [{
    unitId: 11, unitNo: "101", dong: null, occupancyId: 21, tenantName: "홍길동", payerName: "김납부", phone: "010",
    payerNo: "P-101", billNameDisplay: "name", totalAmount: 38000, autoDebit: true,
    issueType: null, dueDate: null, sendStatus: null, issuedAt: null,
  }],
} as AdjustmentBuildingDocuments;

describe("AdjustmentPrintView", () => {
  it("건물별 전월·당월·증감 및 자동이체와 QR을 출력", () => {
    render(<AdjustmentPrintView companyName="한빛관리" period="2026-08-01" buildings={[bundle]} />);
    expect(screen.getByRole("heading", { name: "조정명세서" })).toBeInTheDocument();
    expect(screen.getByText(/행복빌라/)).toBeInTheDocument();
    expect(screen.getByText("35,000원")).toBeInTheDocument();
    expect(screen.getByText("38,000원")).toBeInTheDocument();
    expect(screen.getAllByText("+3,000원").length).toBeGreaterThan(0);
    expect(screen.getByText("자동이체")).toBeInTheDocument();
    expect(screen.getByLabelText("고지서 QR")).toBeInTheDocument();
  });
});
