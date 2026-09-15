import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toastSuccess, toastError, saveMutate, ledgerRows } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  saveMutate: vi.fn(),
  ledgerRows: [{
    id: 11,
    orgId: 9,
    buildingId: 3,
    entryDate: "2026-02-01",
    entryNo: "001",
    fundNote: "정기 적립",
    deposit: 500_000,
    withdrawal: 700_000,
    balance: -200_000,
    memo: "2월분",
    createdAt: "2026-02-01T00:00:00Z",
    updatedAt: "2026-02-01T00:00:00Z",
  }],
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));
vi.mock("@/hooks/reactquery/longTermRepair", () => ({
  useLongTermRepairLedger: vi.fn((buildingId: number | null) => ({
    data: buildingId ? ledgerRows : [],
    isLoading: false,
    isFetching: false,
    isError: false,
  })),
  useLongTermRepairOpeningBalance: () => ({ data: 0, isLoading: false, isError: false }),
  useSaveLongTermRepairLedger: () => ({ mutateAsync: saveMutate, isPending: false }),
}));
vi.mock("@/hooks/reactquery/attachments", () => ({
  useAttachmentsByEntities: () => ({ data: [] }),
  useUploadAttachments: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteAttachment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAttachmentSignedUrls: () => [],
}));

import { LongTermRepairLedger, recalculateLedgerRows } from "./LongTermRepairLedger";

const buildings = [{ id: 3, orgId: 9, code: "B001", name: "한빛빌딩" }] as never;

beforeEach(() => {
  vi.clearAllMocks();
  saveMutate.mockResolvedValue(undefined);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("LongTermRepairLedger", () => {
  it("페이지 제목을 본문에 중복 렌더링하지 않는다", () => {
    render(<LongTermRepairLedger orgId={9} companyName="한빛관리" buildings={buildings} />);

    const pageBody = screen.getByTestId("long-term-repair-screen");
    expect(pageBody.querySelector(":scope > header")).toBeNull();
    expect(screen.queryByText("장기수선비 관리")).toBeNull();
  });

  it("건물 미선택 안내와 커스텀 기간 드롭다운을 표시한다", () => {
    const { container } = render(<LongTermRepairLedger orgId={9} companyName="한빛관리" buildings={buildings} />);

    expect(screen.getByText("좌측에서 건물을 선택해 주세요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "조회 시작 연도" })).toHaveAttribute("aria-haspopup", "listbox");
    expect(container.querySelector("select")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "출력" }));
    expect(toastError).toHaveBeenCalledWith("건물을 먼저 선택해 주세요");
  });

  it("건물 선택 시 분리 컬럼·서버 잔액·하단 합계를 표시한다", () => {
    render(<LongTermRepairLedger orgId={9} companyName="한빛관리" buildings={buildings} />);

    fireEvent.click(screen.getByRole("button", { name: /B001/ }));

    expect(screen.getByRole("columnheader", { name: "적립금 적요" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "적요" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "영수증" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "사진" })).toBeInTheDocument();
    const ledgerTable = screen.getByTestId("long-term-repair-ledger").querySelector("table");
    expect(ledgerTable?.querySelector("colgroup")).toBeNull();
    expect(ledgerTable).not.toHaveStyle({ tableLayout: "fixed" });
    expect(screen.getAllByText("-200,000").length).toBeGreaterThan(0);
    expect(screen.getByText("적립금입금 합계")).toBeInTheDocument();
    expect(screen.getByText("적립금출금 합계")).toBeInTheDocument();
    expect(screen.getByText("현잔액")).toBeInTheDocument();
  });

  it("수정 모드 진입 토스트와 변경 전 저장 비활성을 적용한다", () => {
    render(<LongTermRepairLedger orgId={9} companyName="한빛관리" buildings={buildings} />);
    fireEvent.click(screen.getByRole("button", { name: /B001/ }));
    fireEvent.click(screen.getByRole("button", { name: "수정" }));

    expect(toastSuccess).toHaveBeenCalledWith("내역을 수정할 수 있어요");
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "적립금 적요" }), { target: { value: "변경 적립" } });
    expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
  });

  it("추가 행 일자에 앱 공용 커스텀 달력을 사용한다", async () => {
    const { container } = render(<LongTermRepairLedger orgId={9} companyName="한빛관리" buildings={buildings} />);
    fireEvent.click(screen.getByRole("button", { name: /B001/ }));
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(container.querySelector('input[type="date"]')).toBeNull();
    const dateTrigger = screen.getByRole("button", { name: "일자" });
    fireEvent.click(dateTrigger);
    const calendar = await screen.findByRole("dialog", { name: /달력$/ });
    fireEvent.click(within(calendar).getByRole("button", { name: "20" }));

    expect(dateTrigger).toHaveTextContent(/\.20$/);
  });
});

describe("recalculateLedgerRows", () => {
  it("일자·번호 순으로 직전 잔액 + 입금 - 출금을 누적한다", () => {
    const rows = recalculateLedgerRows([
      { clientKey: "b", entryDate: "2026-02-01", entryNo: "002", fundNote: "출금", deposit: 0, withdrawal: 40, balance: 0, memo: "" },
      { clientKey: "a", entryDate: "2026-02-01", entryNo: "001", fundNote: "입금", deposit: 100, withdrawal: 0, balance: 0, memo: "" },
    ], 20);

    expect(rows.map((row) => [row.clientKey, row.balance])).toEqual([["a", 120], ["b", 80]]);
  });
});
