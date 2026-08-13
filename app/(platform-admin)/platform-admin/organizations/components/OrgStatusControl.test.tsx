import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrgStatusControl } from "./OrgStatusControl";

it("상태를 바꾸면 onChange에 새 상태를 전달한다", async () => {
  const onChange = vi.fn().mockResolvedValue(undefined);
  render(<OrgStatusControl status="trial" onChange={onChange} isPending={false} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "active" } });
  await waitFor(() => expect(onChange).toHaveBeenCalledWith("active"));
});

it("같은 상태를 고르면 onChange를 호출하지 않는다", () => {
  const onChange = vi.fn();
  render(<OrgStatusControl status="active" onChange={onChange} isPending={false} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "active" } });
  expect(onChange).not.toHaveBeenCalled();
});
