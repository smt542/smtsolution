import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("./components/BuildingList", () => ({ BuildingList: () => <div>LIST</div> }));
import SetupPage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
beforeEach(() => vi.clearAllMocks());

describe("BuildingsPage 게이트", () => {
  it("buildings 권한 없으면 차단", () => {
    vi.mocked(useMe).mockReturnValue({ data: { role: "field_staff", permissions: [] } } as unknown as ReturnType<typeof useMe>);
    render(<SetupPage />);
    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText("LIST")).toBeNull();
  });
  it("buildings 권한 있으면 목록", () => {
    vi.mocked(useMe).mockReturnValue({ data: { role: "staff", permissions: ["buildings"] } } as unknown as ReturnType<typeof useMe>);
    render(<SetupPage />);
    expect(screen.getByText("LIST")).toBeInTheDocument();
  });
});
