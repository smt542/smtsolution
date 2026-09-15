import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveMutate = vi.fn();
const completeMutate = vi.fn();
const midMutate = vi.fn();
const deleteMutate = vi.fn();

vi.mock("@/hooks/reactquery/movingSettlement", () => ({
  useSaveSettlement: () => ({ mutate: saveMutate, isPending: false }),
  useCompleteSettlement: () => ({ mutate: completeMutate, isPending: false }),
  useMidMoveout: () => ({ mutate: midMutate, isPending: false }),
  useDeleteSettlement: () => ({ mutate: deleteMutate, isPending: false }),
}));
vi.mock("@/hooks/common/useAppToast", () => ({
  appToast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

import { SettlementActions } from "./SettlementActions";

const draft = {
  moveOutDate: "2026-08-13",
  mgmtFeeMonthly: 300000,
  mgmtFeeProrated: 125806,
  waterCharge: 12000,
  elecCharge: 23000,
  gasCharge: 8000,
  elecPaidDate: "",
  gasPaidDate: "",
  repairAmount: 50000,
  repairAttribution: "owner" as const,
  repairMemo: "",
  settleBank: "",
  settleAcct: "",
  settleHolder: "",
  note: "",
  settlementNote: "",
};

const input = {
  unitId: 101,
  occupancyId: 9,
  settlementId: 31,
  data: {
    ...draft,
    elecPaidDate: null,
    gasPaidDate: null,
    repairMemo: null,
    settleBank: null,
    settleAcct: null,
    settleHolder: null,
    note: null,
    settlementNote: null,
  },
  checklist: [{ checkItemId: 7, checked: true }],
};

const settlementContext = {
  building: { id: 3, name: "해오름" },
  unit: {
    id: 101,
    unitNo: "101호",
    dong: "A동",
    buildingId: 3,
    buildingName: "해오름",
  },
  occupancy: {
    id: 9,
    tenantName: "홍길동",
    phone: "010-1234-5678",
    alimtalkOptIn: true,
    moveInDate: "2025-08-01",
    settlementNote: null,
    billingNote: null,
    status: "moving_out" as const,
  },
};

const renderActions = (receivedAmount = 0) => render(
  <SettlementActions
    draft={draft}
    input={input}
    settlementId={31}
    amount={218806}
    receivedAmount={receivedAmount}
    onSaved={vi.fn()}
    {...settlementContext}
  />,
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("print", vi.fn());
});

describe("SettlementActions", () => {
  it("저장 payload를 mutation에 전달한다", () => {
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(saveMutate).toHaveBeenCalledWith(input, expect.any(Object));
  });

  it("미수금이 있으면 중도퇴실 처리를 막고 수납 입력을 안내한다", () => {
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "정산완료+중도퇴실" }));
    expect(screen.getByRole("heading", { name: "중도퇴실 처리 전 확인" })).toBeInTheDocument();
    expect(screen.getByText(/218,806원/)).toBeInTheDocument();
    expect(midMutate).not.toHaveBeenCalled();
  });

  it("수납이 끝난 뒤 확인하면 중도퇴실 RPC를 호출한다", () => {
    renderActions(218806);

    fireEvent.click(screen.getByRole("button", { name: "정산완료+중도퇴실" }));
    fireEvent.click(screen.getByRole("button", { name: "중도퇴실 처리" }));
    expect(midMutate).toHaveBeenCalledWith(31, expect.any(Object));
  });

  it("수납이 끝난 뒤 확인하면 퇴실 완료 RPC를 호출한다", () => {
    renderActions(218806);

    fireEvent.click(screen.getByRole("button", { name: "정산완료+퇴실" }));
    fireEvent.click(screen.getByRole("button", { name: "퇴실 처리" }));
    expect(completeMutate).toHaveBeenCalledWith(31, expect.any(Object));
  });

  it("삭제 확인 뒤 정산 삭제 mutation을 호출한다", () => {
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(screen.getByRole("heading", { name: "이사정산 삭제" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "삭제" }));
    expect(deleteMutate).toHaveBeenCalledWith(31, expect.any(Object));
  });

  it("출력과 빈양식 버튼을 제공한다", () => {
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "출력" }));
    fireEvent.click(screen.getByRole("button", { name: "빈양식" }));
    expect(window.print).toHaveBeenCalledTimes(2);
  });
});
