import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OccupancyHistorySection } from "./OccupancyHistorySection";

describe("OccupancyHistorySection", () => {
  it("전출 당시 집전화와 주·부 전화 스냅샷을 읽기 전용 표에 표시한다", () => {
    render(<OccupancyHistorySection history={[{
      id: 1, unitId: 3, tenantName: "김전출", phone: "010-1111", phone2: "010-2222", phone3: "02-3333",
      moveInDate: "2025-01-01", moveOutDate: "2026-01-01", roomTypeLabel: "원룸",
    }]} />);
    expect(screen.getByText("김전출")).toBeInTheDocument();
    expect(screen.getByText("02-3333")).toBeInTheDocument();
    expect(screen.getByText("010-1111")).toBeInTheDocument();
    expect(screen.getByText("010-2222")).toBeInTheDocument();
  });
});
