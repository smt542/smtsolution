import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MeterInfoPanel } from "./MeterInfoPanel";

describe("MeterInfoPanel", () => {
  it("수도·전기·가스 전월·당월·사용량을 표시한다", () => {
    render(
      <MeterInfoPanel
        meters={[
          { utility: "water", previousReading: 10, currentReading: 14, usage: 4 },
          { utility: "elec", previousReading: 100, currentReading: 125, usage: 25 },
          { utility: "gas", previousReading: null, currentReading: null, usage: null },
        ]}
      />,
    );

    expect(screen.getByText("수도")).toBeInTheDocument();
    expect(screen.getByText("전기")).toBeInTheDocument();
    expect(screen.getByText("가스")).toBeInTheDocument();
    expect(screen.getByText("125")).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });
});
