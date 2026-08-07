import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("open이면 title/children 표시, ESC로 onClose", async () => {
    const onClose = vi.fn();
    render(<Modal open title="건물 등록" onClose={onClose}><p>본문</p></Modal>);
    expect(screen.getByText("건물 등록")).toBeInTheDocument();
    expect(screen.getByText("본문")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
  it("open=false면 렌더 안 함", () => {
    render(<Modal open={false} title="x" onClose={() => {}}>c</Modal>);
    expect(screen.queryByText("x")).toBeNull();
  });
});
