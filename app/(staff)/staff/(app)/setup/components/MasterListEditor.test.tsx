// app/(staff)/staff/setup/components/MasterListEditor.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MasterListEditor } from "./MasterListEditor";

const items = [{ id: 1, label: "원룸" }, { id: 2, label: "투룸" }];

describe("MasterListEditor", () => {
  it("항목 렌더", () => {
    render(<MasterListEditor title="룸타입" items={items} onAdd={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("원룸")).toBeInTheDocument();
    expect(screen.getByText("투룸")).toBeInTheDocument();
  });
  it("추가: 입력 후 ＋추가 → onAdd(label)", () => {
    const onAdd = vi.fn();
    render(<MasterListEditor title="룸타입" items={items} onAdd={onAdd} onRename={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("룸타입 추가"), { target: { value: "쓰리룸" } });
    fireEvent.click(screen.getByRole("button", { name: /추가/ }));
    expect(onAdd).toHaveBeenCalledWith("쓰리룸");
  });
  it("빈 값 추가 무시", () => {
    const onAdd = vi.fn();
    render(<MasterListEditor title="룸타입" items={items} onAdd={onAdd} onRename={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /추가/ }));
    expect(onAdd).not.toHaveBeenCalled();
  });
  it("삭제: onDelete(id)", () => {
    const onDelete = vi.fn();
    render(<MasterListEditor title="룸타입" items={items} onAdd={vi.fn()} onRename={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "원룸 삭제" }));
    expect(onDelete).toHaveBeenCalledWith(1);
  });
  it("수정: 수정→변경→저장 → onRename(id,label)", () => {
    const onRename = vi.fn();
    render(<MasterListEditor title="룸타입" items={items} onAdd={vi.fn()} onRename={onRename} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "원룸 수정" }));
    fireEvent.change(screen.getByLabelText("룸타입 이름 변경"), { target: { value: "원룸형" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onRename).toHaveBeenCalledWith(1, "원룸형");
  });
});
