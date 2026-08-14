import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FeeItemLookupRow } from "@/hooks/reactquery/feeItems";
import { FeeItemLookupTable } from "./FeeItemLookupTable";

const rows: FeeItemLookupRow[] = [
  {
    id: 1,
    typeId: 7,
    typeLabel: "원룸텔",
    name: "일반관리비",
    rounding: "round",
    dailyProration: true,
    carryOver: false,
    isRequired: true,
    sortOrder: 0,
  },
  {
    id: 2,
    typeId: 8,
    typeLabel: "상가",
    name: "청소비",
    rounding: "raw",
    dailyProration: false,
    carryOver: true,
    isRequired: false,
    sortOrder: 1,
  },
];

describe("FeeItemLookupTable", () => {
  it("renders fee-item labels and boolean values in the read-only table", () => {
    render(<FeeItemLookupTable rows={rows} />);

    expect(screen.getByRole("columnheader", { name: "건물유형" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "항목명" })).toBeInTheDocument();
    expect(screen.getByText("원룸텔")).toBeInTheDocument();
    expect(screen.getByText("상가")).toBeInTheDocument();
    expect(screen.getByText("일반관리비")).toBeInTheDocument();
    expect(screen.getByText("청소비")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "반올림" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "원값" })).toBeInTheDocument();
    expect(screen.getAllByText("Y")).toHaveLength(2);
    expect(screen.getAllByText("N")).toHaveLength(2);
    expect(screen.getByRole("cell", { name: "필수" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "선택" })).toBeInTheDocument();
  });
});
