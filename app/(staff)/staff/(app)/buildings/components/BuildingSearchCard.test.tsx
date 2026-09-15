import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  BuildingSearchCard,
  initialBuildingFilter,
  type BuildingFilterState,
} from "./BuildingSearchCard";

function Harness({ onSearch = vi.fn(), onFilterChange = vi.fn() }) {
  const [value, setValue] = useState("");
  const [filter, setFilter] = useState(initialBuildingFilter);
  const updateFilter = (next: BuildingFilterState) => {
    setFilter(next);
    onFilterChange(next);
  };
  return (
    <BuildingSearchCard
      value={value}
      onChange={setValue}
      onSearch={onSearch}
      filter={filter}
      onFilterChange={updateFilter}
      staff={[{ id: "s1", name: "홍관리" }]}
    />
  );
}

describe("BuildingSearchCard query controls", () => {
  it("검색어를 제어 상태로 유지하고 검색 이벤트를 전달한다", () => {
    const onSearch = vi.fn();
    render(<Harness onSearch={onSearch} />);
    const search = screen.getByPlaceholderText("건물명·주소 검색");
    fireEvent.change(search, { target: { value: "한빛" } });
    expect(search).toHaveValue("한빛");
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it("필터 선택을 전체 필터 값으로 전달한다", () => {
    const onFilterChange = vi.fn();
    render(<Harness onFilterChange={onFilterChange} />);
    fireEvent.click(screen.getByRole("button", { name: "필터" }));
    fireEvent.click(screen.getByRole("button", { name: "오래된 순" }));
    expect(onFilterChange).toHaveBeenCalledWith({ ...initialBuildingFilter, regSort: "asc" });
  });
});
