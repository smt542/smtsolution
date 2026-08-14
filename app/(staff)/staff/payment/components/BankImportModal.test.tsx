import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentRow } from "@/hooks/reactquery/payments";

const { mutateAsync, parseBankWorkbook } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  parseBankWorkbook: vi.fn(),
}));

vi.mock("@/lib/payments/bankParse", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/payments/bankParse")>()),
  parseBankWorkbook,
}));
vi.mock("@/hooks/reactquery/payments", () => ({
  useBankPayments: vi.fn(() => ({ data: [] })),
  useRecordBankPayments: vi.fn(() => ({ mutateAsync, isPending: false })),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { BankImportModal } from "./BankImportModal";

const rows: PaymentRow[] = [
  {
    unitId: 1,
    unitNo: "101호",
    dong: "A동",
    occupancyId: 11,
    tenantName: "김철수",
    isVacant: false,
    isAutoDebit: false,
    dueDate: null,
    payerNo: "C-1",
    payerName: "김납부",
    charged: 10_000,
    paid: 0,
    unpaid: 10_000,
    payStatus: "unpaid",
  },
];

function uploadFile() {
  const file = new File(["xlsx"], "bank.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  Object.defineProperty(file, "arrayBuffer", {
    value: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  });
  fireEvent.change(screen.getByLabelText("은행 엑셀 파일"), {
    target: { files: [file] },
  });
}

async function openPreview(propsRows: PaymentRow[] = rows) {
  render(
    <BankImportModal
      open
      buildingId={7}
      period="2026-08-01"
      rows={propsRows}
      onClose={vi.fn()}
    />,
  );
  uploadFile();
  await screen.findByLabelText("고객번호 열");
  fireEvent.click(screen.getByRole("button", { name: "미리보기" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mutateAsync.mockResolvedValue({ recorded: 1, skipped: 0 });
  parseBankWorkbook.mockResolvedValue({
    headers: ["입금일", "고객번호", "입금자명", "금액"],
    rows: [["2026-08-10", "C-1", "홍길동", "4,000"]],
  });
});

describe("BankImportModal", () => {
  it("업로드 후 자동 매핑한 호실과 차액을 미리보기에 표시", async () => {
    await openPreview();

    expect(screen.getByText("101호")).toBeInTheDocument();
    expect(screen.getByText("부분")).toBeInTheDocument();
    expect(screen.getByText("6,000원")).toBeInTheDocument();
  });

  it("선택한 매칭 입금을 일괄 확정", async () => {
    await openPreview();
    fireEvent.click(screen.getByRole("button", { name: "일괄 확정" }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        buildingId: 7,
        period: "2026-08-01",
        entries: [
          {
            unitId: 1,
            amount: 4_000,
            paidAt: "2026-08-10",
            memo: "홍길동",
          },
        ],
      });
    });
  });

  it("이름이 여러 세대와 충돌하면 미매칭으로 표시", async () => {
    parseBankWorkbook.mockResolvedValue({
      headers: ["입금일", "입금자명", "금액"],
      rows: [["2026-08-10", "이영희", "5,000"]],
    });
    const collisionRows: PaymentRow[] = [
      { ...rows[0], unitId: 2, unitNo: "102호", payerNo: null, payerName: null, tenantName: "이영희" },
      { ...rows[0], unitId: 3, unitNo: "103호", payerNo: null, payerName: null, tenantName: "이영희" },
    ];

    await openPreview(collisionRows);

    expect(screen.getByRole("heading", { name: "미매칭 입금" })).toBeInTheDocument();
    expect(screen.getByText("이영희")).toBeInTheDocument();
    expect(screen.getByText("5,000원")).toBeInTheDocument();
  });
});
