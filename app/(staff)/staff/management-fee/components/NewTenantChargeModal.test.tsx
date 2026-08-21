import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NewTenantChargeModal } from "./NewTenantChargeModal";

const units = [
  { unitId: 3, unitNo: "301", dong: "A", tenantName: "김신규", moveInDate: "2026-08-20" },
  { unitId: 4, unitNo: "302", dong: null, tenantName: "이신규", moveInDate: "2026-08-25" },
];

describe("NewTenantChargeModal", () => {
  it("open=false면 렌더 안 함", () => {
    const { container } = render(
      <NewTenantChargeModal open={false} units={units} pending={false} onConfirm={vi.fn()} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("세대 목록·안내 문구 표시 + 기본 전체 체크", () => {
    render(<NewTenantChargeModal open units={units} pending={false} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("이번 달 관리비를 부과하시겠습니까?")).toBeInTheDocument();
    expect(screen.getByText(/301/)).toBeInTheDocument();
    expect(screen.getByText(/302/)).toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    boxes.forEach((b) => expect(b).toBeChecked());
  });

  it("확인 시 체크된 unitId 배열로 onConfirm", () => {
    const onConfirm = vi.fn();
    render(<NewTenantChargeModal open units={units} pending={false} onConfirm={onConfirm} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "부과" }));
    expect(onConfirm).toHaveBeenCalledWith([3, 4]);
  });

  it("일부 해제 후 확인 시 체크분만 전달", () => {
    const onConfirm = vi.fn();
    render(<NewTenantChargeModal open units={units} pending={false} onConfirm={onConfirm} onClose={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]); // 301 해제
    fireEvent.click(screen.getByRole("button", { name: "부과" }));
    expect(onConfirm).toHaveBeenCalledWith([4]);
  });

  it("전부 해제 시 부과 버튼 비활성", () => {
    render(<NewTenantChargeModal open units={units} pending={false} onConfirm={vi.fn()} onClose={vi.fn()} />);
    screen.getAllByRole("checkbox").forEach((b) => fireEvent.click(b));
    expect(screen.getByRole("button", { name: "부과" })).toBeDisabled();
  });

  it("취소 시 onClose", () => {
    const onClose = vi.fn();
    render(<NewTenantChargeModal open units={units} pending={false} onConfirm={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalled();
  });
});
