import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PointAdjustmentModal } from "./PointAdjustmentModal";

const organizations = [
  {
    id: 1,
    name: "한빛관리",
    status: "active" as const,
    pointBalance: 1000,
    ledgerBalance: 1000,
    reservedPoints: 0,
    availablePoints: 1000,
    slug: null,
    createdAt: "",
    accountCount: 0,
    buildingCount: 0,
    phone: null,
    deletedAt: null,
    contractStartDate: null,
    contractEndDate: null,
    representativeName: null,
    businessRegistrationNumber: null,
    fax: null,
    email: null,
    address: null,
    region: null,
    operatingHours: null,
    contractFilePath: null,
    unitCount: 0,
    employeeCount: 0,
    tenantCount: 0,
  },
];

describe("PointAdjustmentModal", () => {
  it("차감에 양수 포인트를 입력하면 제출을 막는다", async () => {
    const onSubmit = vi.fn();
    render(
      <PointAdjustmentModal
        open
        onClose={() => {}}
        organizations={organizations}
        onSubmit={onSubmit}
        isPending={false}
      />,
    );

    fireEvent.change(screen.getByLabelText("조정 구분"), { target: { value: "deduction" } });
    fireEvent.change(screen.getByLabelText("조정 포인트"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("조정 사유"), { target: { value: "오지급 회수" } });
    fireEvent.click(screen.getByRole("button", { name: "조정 기록" }));

    await waitFor(() =>
      expect(screen.getByText("차감·환불 포인트는 음수로 입력해 주세요")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("조정 포인트")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("조정 포인트")).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("환불 입력을 숫자로 변환해 제출한다", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <PointAdjustmentModal
        open
        onClose={() => {}}
        organizations={organizations}
        onSubmit={onSubmit}
        isPending={false}
      />,
    );

    fireEvent.change(screen.getByLabelText("조정 구분"), { target: { value: "refund" } });
    fireEvent.change(screen.getByLabelText("조정 포인트"), { target: { value: "-500" } });
    fireEvent.change(screen.getByLabelText("실제 환불액(원)"), { target: { value: "5500" } });
    fireEvent.change(screen.getByLabelText("조정 사유"), { target: { value: "중복 충전" } });
    fireEvent.click(screen.getByRole("button", { name: "조정 기록" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        orgId: 1,
        kind: "refund",
        points: -500,
        amountKrw: 5500,
        memo: "중복 충전",
      }),
    );
  });

  it("서버 실패를 전역 오류로 표시하고 닫지 않는다", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("조정 저장 실패"));
    const onClose = vi.fn();
    render(<PointAdjustmentModal open onClose={onClose} organizations={organizations} onSubmit={onSubmit} isPending={false} />);
    fireEvent.change(screen.getByLabelText("조정 포인트"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("조정 사유"), { target: { value: "정정" } });
    fireEvent.click(screen.getByRole("button", { name: "조정 기록" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("조정 저장 실패");
    expect(onClose).not.toHaveBeenCalled();
  });
});
