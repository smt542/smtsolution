import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PermissionChecklist } from "./PermissionChecklist";

describe("PermissionChecklist", () => {
  it("확정된 그룹과 권한 칩을 렌더", () => {
    render(<PermissionChecklist value={[]} onChange={() => {}} />);
    for (const group of ["관리업무", "공과금 관리", "이사정산", "설정"]) {
      expect(screen.getByRole("heading", { name: group })).toBeInTheDocument();
    }
    for (const chip of [
      "건물·입주자 관리", "관리비 부과 세팅", "항목등록 관리", "서류 발행·출력",
      "미납 관리", "협력업체 관리", "장기수선비 관리", "문자·알림톡 관리",
      "수납 처리", "공지 관리", "민원·AS", "공과금 관리 전체", "이사정산 전체",
      "계정·직원", "셋업 설정",
    ]) {
      expect(screen.getByRole("button", { name: chip })).toBeInTheDocument();
    }
  });

  it("disabled면 클릭해도 onChange 미호출", () => {
    const onChange = vi.fn();
    render(<PermissionChecklist value={[]} onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole("button", { name: "계정·직원" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("건물·입주자 관리 칩은 두 키를 함께 토글", () => {
    const onChange = vi.fn();
    render(<PermissionChecklist value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "건물·입주자 관리" }));
    expect(onChange).toHaveBeenCalledWith(["buildings", "tenants"]);
  });

  it("마스터는 모든 칩이 선택되고 비활성", () => {
    render(<PermissionChecklist value={[]} onChange={() => {}} allGranted />);
    const chips = screen.getAllByRole("button");
    expect(chips).toHaveLength(15);
    for (const chip of chips) {
      expect(chip).toBeDisabled();
      expect(chip).toHaveAttribute("aria-pressed", "true");
    }
  });
});
