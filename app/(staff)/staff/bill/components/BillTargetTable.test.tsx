import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BillTargetTable } from "./BillTargetTable";
import type { BillTarget } from "@/hooks/reactquery/bill";

const t = (o: Partial<BillTarget>): BillTarget => ({
  unitId: 1, unitNo: "101", dong: null, occupancyId: 5, tenantName: "홍길동", payerName: "홍길동", phone: "010",
  secondaryPhone: null, faxNumber: null, payerNo: null, billNameDisplay: "name", totalAmount: 30000, autoDebit: false,
  issueType: null, dueDate: null, sendStatus: null, issuedAt: null, singlePrint: false, waterCutoff: false,
  scheduledAt: null, messageScheduleId: null, kakaoSendStatus: null, faxSendStatus: null, ...o,
});

const actions = {
  onToggle: () => {}, onToggleAll: () => {}, onWaterCutoffChange: () => {},
  onPrint: () => {}, onSend: () => {}, onCancelSchedule: () => {},
};

describe("BillTargetTable", () => {
  it("빈 목록은 안내 문구", () => {
    render(<BillTargetTable targets={[]} unitLabelMode="code" selected={[]} {...actions} />);
    expect(screen.getByText(/부과 확정된 세대가 없습니다/)).toBeInTheDocument();
  });
  it("세대 행·발행상태 표시, 체크 시 onToggle", () => {
    const onToggle = vi.fn();
    render(<BillTargetTable targets={[t({ issuedAt: "2026-08-13T00:00:00Z", autoDebit: true })]} unitLabelMode="code"
      selected={[]} {...actions} onToggle={onToggle} />);
    expect(screen.getByText("101")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "자동이체" })).toBeInTheDocument();
    expect(screen.getByText("발행 완료")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("101 선택"));
    expect(onToggle).toHaveBeenCalledWith(1);
  });
  it("선택 0이면 인쇄·발송 비활성", () => {
    render(<BillTargetTable targets={[t({})]} unitLabelMode="code" selected={[]} {...actions} />);
    expect(screen.getByRole("button", { name: "A4 인쇄" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "카톡 고지서 발송" })).toBeDisabled();
  });
  it("세대별 단수 override와 예약 상태·취소를 노출", () => {
    const onWaterCutoffChange = vi.fn();
    const onCancelSchedule = vi.fn();
    render(<BillTargetTable
      targets={[t({ waterCutoff: true, sendStatus: "scheduled", scheduledAt: "2026-08-20T09:30:00+09:00", messageScheduleId: 4 })]}
      unitLabelMode="code"
      selected={[1]}
      {...actions}
      onWaterCutoffChange={onWaterCutoffChange}
      onCancelSchedule={onCancelSchedule}
    />);
    expect(screen.getByLabelText("101 단수 표기")).toBeChecked();
    expect(screen.getByText("예약 · 2026-08-20 09:30")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("101 단수 표기"));
    fireEvent.click(screen.getByRole("button", { name: "예약 취소" }));
    expect(onWaterCutoffChange).toHaveBeenCalledWith(1, false);
    expect(onCancelSchedule).toHaveBeenCalled();
  });
});
