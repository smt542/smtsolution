import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AccountFormModal } from "./AccountFormModal";
import type { Account } from "@/hooks/reactquery/accounts";

const noop = async () => {};
const baseProps = {
  open: true, onClose: () => {}, roles: [{ id: 1, orgId: 9, label: "관리", sortOrder: 1 }],
  canEditPermissions: true, onCreate: noop, onUpdateBasic: noop, onUpdatePermissions: noop, isPending: false,
};

describe("AccountFormModal", () => {
  it("등록 모드: 아이디·비밀번호 입력 노출", () => {
    render(<AccountFormModal {...baseProps} editing={null} />);
    expect(screen.getByText("계정 등록")).toBeInTheDocument();
    expect(screen.getByLabelText("아이디")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
  });

  it("manager_staff 유형에서 권한 체크리스트 노출", () => {
    render(<AccountFormModal {...baseProps} editing={null} />);
    // 기본 유형 manager_staff → 권한 섹션 제목
    expect(screen.getByText("기능별 권한")).toBeInTheDocument();
  });

  it("canEditPermissions=false면 권한 체크리스트 disabled 안내", () => {
    render(<AccountFormModal {...baseProps} editing={null} canEditPermissions={false} />);
    expect(screen.getByText(/마스터 직원만/)).toBeInTheDocument();
  });

  it("수정 모드(tenant): 읽기전용 안내 노출", () => {
    const tenant: Account = {
      userId: "t1", username: "tenant1", fullName: "세입자", phone: null, phoneSub: null,
      role: "tenant", staffType: "tenant", affiliation: null, isActive: true, permissions: [], roleLabels: [],
    };
    render(<AccountFormModal {...baseProps} editing={tenant} />);
    expect(screen.getByText(/입주자 상세에서/)).toBeInTheDocument();
  });

  it("수정 모드: 담당역할은 읽기전용(StaffRoleSelect 미렌더, 안내문 노출)", () => {
    const staff: Account = {
      userId: "s1", username: "staff1", fullName: "홍직원", phone: null, phoneSub: null,
      role: "staff", staffType: "manager_staff", affiliation: null, isActive: true,
      permissions: [], roleLabels: ["검침전용역할", "청소전용역할"],
    };
    render(<AccountFormModal {...baseProps} editing={staff} />);
    // 읽기전용 텍스트로 현재 역할 표시
    expect(screen.getByText("검침전용역할, 청소전용역할")).toBeInTheDocument();
    expect(screen.getByText(/담당역할 변경은 준비 중입니다/)).toBeInTheDocument();
    // StaffRoleSelect는 렌더되지 않으므로 해당 역할 레이블 체크박스 없음
    expect(screen.queryByRole("checkbox", { name: "검침전용역할" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "청소전용역할" })).toBeNull();
  });
});
