import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChecklistSection } from "./ChecklistSection";

describe("ChecklistSection", () => {
  it("체크 변경을 item id와 함께 전달한다", () => {
    const onChange = vi.fn();

    render(
      <ChecklistSection
        items={[{ id: 7, label: "열쇠 반납", checked: false }]}
        checked={{ 7: false }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "열쇠 반납" }));
    expect(onChange).toHaveBeenCalledWith(7, true);
  });
});
