import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GiroPrintView, type GiroOutputDocument } from "./GiroPrintView";

const entry = {
  building: { id: 7, orgId: 1, code: "B007", name: "행복빌라", address: "서울시 마포구" },
  document: {
    unitId: 11, unitNo: "101", dong: "A동", tenantName: "홍길동", totalAmount: 35400,
    autoDebit: true, items: [{ feeItemId: 1, name: "관리비", charged: true, amount: 35400 }],
    billingNote: null, unitNotice: null,
  },
  target: {
    unitId: 11, unitNo: "101", dong: "A동", occupancyId: 21, tenantName: "홍길동", payerName: "김납부",
    phone: "010-1234-5678", totalAmount: 35400, autoDebit: true, issueType: null, dueDate: null,
    sendStatus: null, issuedAt: null,
  },
} as GiroOutputDocument;

describe("GiroPrintView", () => {
  it("QR·회사명·세대 연락처·자동이체·스탬프·확정 금액을 출력", () => {
    render(<GiroPrintView companyName="한빛관리" period="2026-08-01" documents={[entry]} accounts={[]} customerNotice={null}
      stamps={{ reissue: true, waterCutoff: true, autoDebit: true }} />);
    expect(screen.getAllByText("한빛관리").length).toBeGreaterThan(0);
    expect(screen.getByText("김납부")).toBeInTheDocument();
    expect(screen.getByText("010-1234-5678")).toBeInTheDocument();
    expect(screen.getAllByText("35,400원").length).toBeGreaterThan(0);
    expect(screen.getByText("재발행")).toBeInTheDocument();
    expect(screen.getByText("단수")).toBeInTheDocument();
    expect(screen.getAllByText(/자동이체/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("고지서 QR")).toBeInTheDocument();
  });
});
