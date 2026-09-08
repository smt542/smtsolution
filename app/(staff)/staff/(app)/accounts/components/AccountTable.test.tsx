import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AccountTable } from "./AccountTable";
import type { Account } from "@/hooks/reactquery/accounts";

const accounts: Account[] = [
  { userId: "u1", username: "kim", fullName: "김직원", phone: "010-1", phoneSub: null,
    role: "staff", staffType: "manager_staff", affiliation: null, isActive: true, permissions: ["buildings"], roleLabels: ["관리"] },
  { userId: "u2", username: "boss", fullName: "이관리", phone: null, phoneSub: null,
    role: "org_owner", staffType: "manager_staff", affiliation: null, isActive: false, permissions: [], roleLabels: [] },
];

describe("AccountTable", () => {
  it("설계 순서의 6개 컬럼과 마스킹 비밀번호를 렌더", () => {
    render(<AccountTable accounts={accounts} onRowClick={() => {}} onToggleActive={() => {}} />);
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "이름", "아이디", "비밀번호", "연락처", "유형", "상태",
    ]);
    expect(screen.getByText("김직원")).toBeInTheDocument();
    expect(screen.getByText("이관리")).toBeInTheDocument();
    expect(screen.getByText("마스터")).toBeInTheDocument();
    expect(screen.getByText("일반")).toBeInTheDocument();
    expect(screen.getAllByText("●●●●")).toHaveLength(2);
    expect(screen.getByText("활성화")).toBeInTheDocument();
    expect(screen.getByText("비활성화")).toBeInTheDocument();
  });

  it("행 클릭 시 onRowClick", () => {
    const onRowClick = vi.fn();
    render(<AccountTable accounts={accounts} onRowClick={onRowClick} onToggleActive={() => {}} />);
    fireEvent.click(screen.getByText("김직원"));
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1" }));
  });

  it("상태 버튼 클릭 시 onToggleActive", () => {
    const onToggleActive = vi.fn();
    render(<AccountTable accounts={accounts} onRowClick={() => {}} onToggleActive={onToggleActive} />);
    fireEvent.click(screen.getByRole("button", { name: "김직원 비활성화" }));
    expect(onToggleActive).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1" }));
  });
});
