// app/(staff)/staff/bill/components/BillPrintView.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BillPrintView } from "./BillPrintView";
import type { BillDocument } from "@/hooks/reactquery/bill";

const doc: BillDocument = {
  unitId: 1, unitNo: "101", dong: null, tenantName: "홍길동", totalAmount: 35000, autoDebit: true,
  items: [{ feeItemId: 10, name: "관리비", charged: true, amount: 30000 }, { feeItemId: 11, name: "수도", charged: true, amount: 5000 }],
  billingNote: null, unitNotice: "동파 주의",
};

describe("BillPrintView", () => {
  it("세대·항목·합계·자동이체·계좌·안내·QR을 렌더", () => {
    render(<BillPrintView buildingName="행복빌라" period="2026-08-01" unitLabelMode="code" dueDate="2026-08-25"
      accounts={[{ bank: "국민", acct: "123", holder: "관리" }]} customerNotice="안내문" documents={[doc]} />);
    expect(screen.getByText(/행복빌라 2026년 08월 관리비 고지서/)).toBeInTheDocument();
    expect(screen.getByText("관리비")).toBeInTheDocument();
    expect(screen.getByText("35,000원")).toBeInTheDocument();   // 합계
    expect(screen.getByText(/자동이체/)).toBeInTheDocument();
    expect(screen.getByText(/국민 123/)).toBeInTheDocument();
    expect(screen.getByText("안내문")).toBeInTheDocument();
    expect(screen.getByText("동파 주의")).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeTruthy();          // QR
  });
  it("name 모드는 입주자명으로 세대 표기", () => {
    render(<BillPrintView buildingName="B" period="2026-08-01" unitLabelMode="name" dueDate={null}
      accounts={[]} customerNotice={null} documents={[doc]} />);
    expect(screen.getByText(/홍길동/)).toBeInTheDocument();
  });
});
