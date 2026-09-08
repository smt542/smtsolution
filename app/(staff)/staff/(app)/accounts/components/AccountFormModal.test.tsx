import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/hooks/reactquery/accounts";
import { AccountFormModal } from "./AccountFormModal";

const createNoop = async () => ({ userId: "new-user" });
const noop = async () => {};
const baseProps = {
  open: true,
  onClose: () => {},
  createStaffType: "manager_staff" as const,
  canEditPermissions: true,
  onCreate: createNoop,
  onUpdateBasic: noop,
  onUpdatePermissions: noop,
  onResetPassword: noop,
  onSetActive: noop,
  isPending: false,
};

const staff: Account = {
  userId: "s1",
  username: "staff1",
  fullName: "홍직원",
  phone: "010-0000-0000",
  phoneSub: null,
  role: "staff",
  staffType: "manager_staff",
  affiliation: null,
  isActive: true,
  permissions: ["accounts"],
  roleLabels: [],
};

afterEach(() => vi.restoreAllMocks());

describe("AccountFormModal", () => {
  it("등록 모드 필드 순서와 숫자 4자리 PIN 속성을 렌더", () => {
    render(<AccountFormModal {...baseProps} editing={null} />);

    expect(screen.getByRole("heading", { name: "사무실 관리자 등록" })).toBeInTheDocument();
    expect(screen.getByText("필수 항목(*)을 입력해 주세요")).toBeInTheDocument();
    const controls = ["아이디", "비밀번호", "이름", "연락처", "회원 유형", "상태"]
      .map((label) => screen.getByLabelText(label));
    expect(controls.map((control) => control.id)).toEqual([
      "username", "password", "fullName", "phone", "memberType", "status",
    ]);

    const password = screen.getByLabelText("비밀번호");
    expect(password).toHaveAttribute("inputmode", "numeric");
    expect(password).toHaveAttribute("maxlength", "4");
    expect(password).toBeRequired();
    expect(screen.getByText("페이지별 권한")).toBeInTheDocument();
  });

  it("현장 등록 모드는 현장 제목과 staffType을 사용", async () => {
    const onCreate = vi.fn().mockResolvedValue({ userId: "field-user" });
    render(
      <AccountFormModal
        {...baseProps}
        editing={null}
        createStaffType="field_staff"
        onCreate={onCreate}
      />,
    );
    expect(screen.getByRole("heading", { name: "현장 관리자 등록" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("아이디"), { target: { value: "field" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "1234" } });
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "박현장" } });
    fireEvent.submit(screen.getByRole("button", { name: "등록" }).closest("form")!);

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ staffType: "field_staff", role: "field", password: "1234" }),
    ));
  });

  it("등록 PIN이 4자리보다 짧으면 제출하지 않음", async () => {
    const onCreate = vi.fn().mockResolvedValue({ userId: "new-user" });
    render(<AccountFormModal {...baseProps} editing={null} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText("아이디"), { target: { value: "staff" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "홍직원" } });
    fireEvent.submit(screen.getByRole("button", { name: "등록" }).closest("form")!);

    expect(await screen.findByText("비밀번호는 숫자 4자리를 입력해 주세요")).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("수정 PIN은 빈칸이면 유지하고 입력하면 reset 경로를 호출", async () => {
    const onResetPassword = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <AccountFormModal {...baseProps} editing={staff} onResetPassword={onResetPassword} />,
    );

    expect(screen.getByLabelText("비밀번호")).toHaveValue("");
    expect(screen.getByLabelText("비밀번호")).not.toBeRequired();
    fireEvent.submit(screen.getByRole("button", { name: "저장" }).closest("form")!);
    await waitFor(() => expect(onResetPassword).not.toHaveBeenCalled());

    rerender(
      <AccountFormModal {...baseProps} editing={staff} onResetPassword={onResetPassword} />,
    );
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "4321" } });
    fireEvent.submit(screen.getByRole("button", { name: "저장" }).closest("form")!);
    await waitFor(() => expect(onResetPassword).toHaveBeenCalledWith("s1", "4321"));
  });

  it("상태를 비활성화로 저장하면 setActive를 호출", async () => {
    const onSetActive = vi.fn().mockResolvedValue(undefined);
    render(<AccountFormModal {...baseProps} editing={staff} onSetActive={onSetActive} />);
    await userEvent.selectOptions(screen.getByLabelText("상태"), "inactive");
    fireEvent.submit(screen.getByRole("button", { name: "저장" }).closest("form")!);
    await waitFor(() => expect(onSetActive).toHaveBeenCalledWith("s1", false));
  });

  it("삭제 확인 뒤 hard delete 대신 비활성화", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onSetActive = vi.fn().mockResolvedValue(undefined);
    render(<AccountFormModal {...baseProps} editing={staff} onSetActive={onSetActive} />);
    await userEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(window.confirm).toHaveBeenCalledWith("계정을 삭제할까요?");
    expect(onSetActive).toHaveBeenCalledWith("s1", false);
  });

  it("마스터 선택 시 모든 권한 칩을 선택·비활성 표시", async () => {
    render(<AccountFormModal {...baseProps} editing={null} />);
    await userEvent.selectOptions(screen.getByLabelText("회원 유형"), "master");
    const chip = screen.getByRole("button", { name: "건물·입주자 관리" });
    expect(chip).toBeDisabled();
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("canEditPermissions=false면 권한 칩을 조회만 가능", () => {
    render(<AccountFormModal {...baseProps} editing={null} canEditPermissions={false} />);
    expect(screen.getByText("마스터 직원만 권한을 변경할 수 있습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "계정·직원" })).toBeDisabled();
  });

  it("수정 모드 tenant는 기존 읽기전용 안내를 유지", () => {
    const tenant: Account = {
      userId: "t1",
      username: "tenant1",
      fullName: "세입자",
      phone: null,
      phoneSub: null,
      role: "tenant",
      staffType: "tenant",
      affiliation: null,
      isActive: true,
      permissions: [],
      roleLabels: [],
    };
    render(<AccountFormModal {...baseProps} editing={tenant} />);
    expect(screen.getByText(/입주자 상세에서/)).toBeInTheDocument();
  });
});
