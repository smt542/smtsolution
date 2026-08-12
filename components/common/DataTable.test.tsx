// components/common/DataTable.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DataTable } from "./DataTable";

describe("DataTable", () => {
  it("행 더블클릭 시 onRowDoubleClick(row) 호출", () => {
    const onDbl = vi.fn();
    render(
      <DataTable
        columns={[{ key: "name", label: "이름" }]}
        rows={[{ name: "가나빌" }]}
        onRowDoubleClick={onDbl}
      />,
    );
    fireEvent.doubleClick(screen.getByText("가나빌"));
    expect(onDbl).toHaveBeenCalledWith({ name: "가나빌" });
  });
});
