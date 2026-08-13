import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  calculateProratedMgmtFee,
  SettlementForm,
  type SettlementDraft,
} from "./SettlementForm";

const draft: SettlementDraft = {
  moveOutDate: "2026-08-13",
  mgmtFeeMonthly: 300000,
  mgmtFeeProrated: 125806,
  waterCharge: 12000,
  elecCharge: 23000,
  gasCharge: 8000,
  elecPaidDate: "",
  gasPaidDate: "",
  repairAmount: 50000,
  repairAttribution: "owner",
  repairMemo: "",
  settleBank: "",
  settleAcct: "",
  settleHolder: "",
  note: "",
  settlementNote: "",
};

describe("SettlementForm", () => {
  it("해당 월 총일수로 관리비를 반올림 일할한다", () => {
    expect(calculateProratedMgmtFee(300000, "2026-08-13")).toBe(125806);
    expect(calculateProratedMgmtFee(280000, "2026-02-14")).toBe(140000);
  });

  it("월액 변경 시 일할액을 자동 보조한다", () => {
    const onChange = vi.fn();

    render(<SettlementForm value={draft} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("관리비 월액"), {
      target: { value: "310000" },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        mgmtFeeMonthly: 310000,
        mgmtFeeProrated: 130000,
      }),
    );
  });

  it("정산금 합계를 표시한다", () => {
    render(<SettlementForm value={draft} onChange={vi.fn()} />);
    expect(screen.getByText("218,806원")).toBeInTheDocument();
  });
});
