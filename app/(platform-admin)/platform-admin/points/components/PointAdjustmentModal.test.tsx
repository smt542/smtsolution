import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PointAdjustmentModal } from "./PointAdjustmentModal";

const organizations = [
  {
    id: 1,
    name: "한빛관리",
    status: "active" as const,
    pointBalance: 1000,
    slug: null,
    createdAt: "",
    accountCount: 0,
    buildingCount: 0,
    phone: null,
    deletedAt: null,
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
});
