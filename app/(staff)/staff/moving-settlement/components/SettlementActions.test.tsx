import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveMutate = vi.fn();
const completeMutate = vi.fn();
const midMutate = vi.fn();

vi.mock("@/hooks/reactquery/movingSettlement", () => ({
  useSaveSettlement: () => ({ mutate: saveMutate, isPending: false }),
  useCompleteSettlement: () => ({ mutate: completeMutate, isPending: false }),
  useMidMoveout: () => ({ mutate: midMutate, isPending: false }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("confirm", vi.fn(() => true));
});

describe("SettlementActions", () => {
  it("계산+저장 payload를 mutation에 전달한다", () => {
    render(
      <SettlementActions
        draft={draft}
        input={input}
        settlementId={31}
        amount={218806}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "계산+저장" }));
    expect(saveMutate).toHaveBeenCalledWith(input, expect.any(Object));
  });

  it("중도퇴실 확인 뒤 RPC mutation을 호출한다", () => {
    render(
      <SettlementActions
        draft={draft}
        input={input}
        settlementId={31}
        amount={218806}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "중도퇴실" }));
    expect(midMutate).toHaveBeenCalledWith(31, expect.any(Object));
  });

  it("미납 확인 모달 뒤 정산완료를 호출한다", () => {
    render(
      <SettlementActions
        draft={draft}
        input={input}
        settlementId={31}
        amount={218806}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "정산완료+공실" }));
    expect(screen.getByText("미납 수납 확인")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "확인하고 완료" }));
    expect(completeMutate).toHaveBeenCalledWith(31, expect.any(Object));
  });
});
