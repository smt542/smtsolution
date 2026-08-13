import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BillDocument } from "@/lib/billing/billDoc";

vi.mock("./QRCode", () => ({
  QRCode: ({ value }: { value: string }) => <div data-testid="qr">{value}</div>,
}));

import { BillPreview } from "./BillPreview";

const doc: BillDocument = {
  unitId: 1,
  title: "홍길동",
  unitNo: "101",
  tenantName: "홍길동",
  period: "2026-08-01",
  dueDate: "2026-08-25",
  lines: [
    { name: "관리비", amount: 30_000 },
    { name: "장기수선충당금", amount: 5_000 },
  ],
  total: 35_000,
  accounts: [{ bank: "국민", acct: "123", holder: "관리단" }],
  showCutoff: false,
  qrValue: "bill:1:2026-08-01",
};

describe("BillPreview", () => {
  it("항목, 합계, 계좌, 납기일과 QR을 표시한다", () => {
    render(<BillPreview docs={[doc]} issueType="a4" />);

    expect(screen.getByText("관리비")).toBeInTheDocument();
    expect(screen.getByText("35,000")).toBeInTheDocument();
    expect(screen.getByText(/국민 123.*관리단/)).toBeInTheDocument();
    expect(screen.getByText(/2026-08-25/)).toBeInTheDocument();
    expect(screen.getByTestId("qr")).toHaveTextContent("bill:1:2026-08-01");
  });

  it("회사명은 제공될 때만 표시한다", () => {
    const { rerender } = render(<BillPreview docs={[doc]} issueType="a4" />);
    expect(screen.queryByText("가나관리")).not.toBeInTheDocument();

    rerender(<BillPreview docs={[doc]} issueType="a4" companyName="가나관리" />);
    expect(screen.getByText("가나관리")).toBeInTheDocument();
  });

  it("단전·단수 옵션이 켜진 문서에 예고 문구를 표시한다", () => {
    render(<BillPreview docs={[{ ...doc, showCutoff: true }]} issueType="giro" />);

    expect(screen.getByText(/단전·단수 예고/)).toBeInTheDocument();
  });
});
