import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PointChargeModal } from "./PointChargeModal";

const orgs = [
  { id: 1, name: "한빛관리", status: "active" as const, pointBalance: 0, slug: null, createdAt: "", accountCount: 0, buildingCount: 0 },
];

it("포인트가 0 이하이면 제출을 막고 오류를 표시한다", async () => {
  const onSubmit = vi.fn();
  render(<PointChargeModal open onClose={() => {}} organizations={orgs} onSubmit={onSubmit} isPending={false} />);
  fireEvent.change(screen.getByLabelText("충전 포인트"), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "충전 기록" }));
  await waitFor(() => expect(screen.getByText("충전 포인트는 1 이상이어야 합니다")).toBeInTheDocument());
  expect(onSubmit).not.toHaveBeenCalled();
});

it("유효 입력이면 onSubmit에 coerce된 숫자를 전달한다", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<PointChargeModal open onClose={() => {}} organizations={orgs} onSubmit={onSubmit} isPending={false} />);
  fireEvent.change(screen.getByLabelText("대상 조직"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("충전 포인트"), { target: { value: "1000" } });
  fireEvent.change(screen.getByLabelText("결제금액(원)"), { target: { value: "110000" } });
  fireEvent.click(screen.getByRole("button", { name: "충전 기록" }));
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 1, points: 1000, amountKrw: 110000 }),
    ),
  );
});
