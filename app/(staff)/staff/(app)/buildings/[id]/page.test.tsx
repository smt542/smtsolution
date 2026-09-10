import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStaffContext: vi.fn(),
}));

vi.mock("../../_staffContext", () => ({ getStaffContext: mocks.getStaffContext }));
vi.mock("../new-v2/_components/BuildingRegisterForm", () => ({
  BuildingRegisterForm: ({ buildingId }: { buildingId: number }) => <div>BUILDING {buildingId}</div>,
}));

import BuildingDetailPage from "./page";

beforeEach(() => vi.clearAllMocks());

describe("BuildingDetailPage 게이트", () => {
  it("buildings 권한이 없으면 차단한다", async () => {
    mocks.getStaffContext.mockResolvedValue({ role: "staff", permissions: [] });

    render(await BuildingDetailPage({ params: Promise.resolve({ id: "17" }) }));

    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
  });

  it("buildings 권한이 있으면 숫자 buildingId를 폼에 전달한다", async () => {
    mocks.getStaffContext.mockResolvedValue({ role: "staff", permissions: ["buildings"] });

    render(await BuildingDetailPage({ params: Promise.resolve({ id: "17" }) }));

    expect(screen.getByText("BUILDING 17")).toBeInTheDocument();
  });
});
