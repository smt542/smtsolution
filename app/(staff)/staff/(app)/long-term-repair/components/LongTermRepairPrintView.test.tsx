import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LongTermRepairPrintView } from "./LongTermRepairPrintView";

describe("LongTermRepairPrintView", () => {
  it("명세 컬럼·합계 현잔액·회사명 워터마크를 출력한다", () => {
    render(
      <LongTermRepairPrintView
        buildingName="한빛빌딩"
        companyName="한빛관리"
        startMonth="2026-01"
        endMonth="2026-02"
        rows={[{
          key: "1",
          entryDate: "2026-02-01",
          entryNo: "001",
          fundNote: "정기 적립",
          deposit: 500_000,
          withdrawal: 100_000,
          balance: 400_000,
        }]}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "적립금내용" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "차인잔액" })).toBeInTheDocument();
    expect(screen.getByText("합계 >> 현잔액")).toBeInTheDocument();
    expect(screen.getAllByText("한빛관리").length).toBeGreaterThanOrEqual(2);
  });
});
