// app/(staff)/staff/buildings/[id]/components/tenant-sections/MetersAccountsSection.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MetersAccountsSection, type MeterRow, type AccountRow } from "./MetersAccountsSection";
const meters: MeterRow[] = [{ utility:"water", meterNo:"", customerNo:"" }, { utility:"elec", meterNo:"", customerNo:"" }, { utility:"gas", meterNo:"", customerNo:"" }];
const accounts: AccountRow[] = [{ kind:"water", bank:"", account:"", holder:"", cmsMemberNo:"", payerNo:"" }, { kind:"elec", bank:"", account:"", holder:"", cmsMemberNo:"", payerNo:"" }, { kind:"gas", bank:"", account:"", holder:"", cmsMemberNo:"", payerNo:"" }, { kind:"mgmt", bank:"", account:"", holder:"", cmsMemberNo:"", payerNo:"" }];
describe("MetersAccountsSection", () => {
  it("수도 계량기번호 입력 → onMeters 갱신", () => {
    const onMeters = vi.fn();
    render(<MetersAccountsSection meters={meters} accounts={accounts} onMeters={onMeters} onAccounts={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("수도 계량기번호"), { target: { value: "W-1" } });
    const next = onMeters.mock.calls[0][0] as MeterRow[];
    expect(next.find((m) => m.utility === "water")?.meterNo).toBe("W-1");
  });
  it("관리비 계좌 예금주 입력 → onAccounts 갱신", () => {
    const onAccounts = vi.fn();
    render(<MetersAccountsSection meters={meters} accounts={accounts} onMeters={vi.fn()} onAccounts={onAccounts} />);
    fireEvent.change(screen.getByLabelText("관리비 예금주"), { target: { value: "관리단" } });
    const next = onAccounts.mock.calls[0][0] as AccountRow[];
    expect(next.find((a) => a.kind === "mgmt")?.holder).toBe("관리단");
  });
  it("관리비 수납 고객번호 입력 → onAccounts 갱신", () => {
    const onAccounts = vi.fn();
    render(<MetersAccountsSection meters={meters} accounts={accounts} onMeters={vi.fn()} onAccounts={onAccounts} />);
    fireEvent.change(screen.getByLabelText("관리비 수납 고객번호"), { target: { value: "PAYER-1" } });
    const next = onAccounts.mock.calls[0][0] as AccountRow[];
    expect(next.find((a) => a.kind === "mgmt")?.payerNo).toBe("PAYER-1");
    expect(screen.queryByLabelText("수도 수납 고객번호")).not.toBeInTheDocument();
  });
});
