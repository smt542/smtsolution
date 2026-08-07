import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "./Tabs";

describe("Tabs", () => {
  it("탭 클릭 시 onChange(id)", async () => {
    const onChange = vi.fn();
    render(<Tabs tabs={[{id:"a",label:"빌라"},{id:"b",label:"빌딩"}]} active="a" onChange={onChange} />);
    await userEvent.click(screen.getByText("빌딩"));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
