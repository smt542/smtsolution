import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BillTargetTable } from "./BillTargetTable";
import type { BillTarget } from "@/hooks/reactquery/bill";

const t = (o: Partial<BillTarget>): BillTarget => ({
  unitId: 1, unitNo: "101", dong: null, occupancyId: 5, tenantName: "홍길동", phone: "010",
  totalAmount: 30000, autoDebit: false, issueType: null, dueDate: null, sendStatus: null, issuedAt: null, ...o,
});

describe("BillTargetTable", () => {
  it("빈 목록은 안내 문구", () => {
    render(<BillTargetTable targets={[]} unitLabelMode="code" selected={[]} onToggle={() => {}} onToggleAll={() => {}} onPrint={() => {}} onSend={() => {}} />);
    expect(screen.getByText(/부과 확정된 세대가 없습니다/)).toBeInTheDocument();
  });
  it("세대 행·발행상태 표시, 체크 시 onToggle", () => {
    const onToggle = vi.fn();
    render(<BillTargetTable targets={[t({ issuedAt: "2026-08-13T00:00:00Z", autoDebit: true })]} unitLabelMode="code"
      selected={[]} onToggle={onToggle} onToggleAll={() => {}} onPrint={() => {}} onSend={() => {}} />);
    expect(screen.getByText("101")).toBeInTheDocument();
    expect(screen.getByText("자동이체")).toBeInTheDocument();
    expect(screen.getByText("발행")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("101 선택"));
    expect(onToggle).toHaveBeenCalledWith(1);
  });
  it("선택 0이면 인쇄·발송 비활성", () => {
    render(<BillTargetTable targets={[t({})]} unitLabelMode="code" selected={[]} onToggle={() => {}} onToggleAll={() => {}} onPrint={() => {}} onSend={() => {}} />);
    expect(screen.getByRole("button", { name: "A4 인쇄" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "문자 발송" })).toBeDisabled();
  });
});
