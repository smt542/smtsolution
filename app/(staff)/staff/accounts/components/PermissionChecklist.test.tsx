import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PermissionChecklist } from "./PermissionChecklist";

describe("PermissionChecklist", () => {
  it("11개 모듈 라벨 렌더", () => {
    render(<PermissionChecklist value={[]} onChange={() => {}} />);
    expect(screen.getByText("계정 관리")).toBeInTheDocument();
    expect(screen.getByText("부과 확정")).toBeInTheDocument();
  });

  it("disabled면 클릭해도 onChange 미호출", () => {
    const onChange = vi.fn();
    render(<PermissionChecklist value={[]} onChange={onChange} disabled />);
    fireEvent.click(screen.getByText("계정 관리"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("체크 클릭 시 해당 키 토글", () => {
    const onChange = vi.fn();
    render(<PermissionChecklist value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText("계정 관리"));
    expect(onChange).toHaveBeenCalledWith(["accounts"]);
  });
});
