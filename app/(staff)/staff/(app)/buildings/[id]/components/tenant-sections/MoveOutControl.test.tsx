import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const executeMutate = vi.fn();
const scheduleMutate = vi.fn();
const cancelMutate = vi.fn();
vi.mock("@/hooks/reactquery/occupancies", () => ({
  useExecuteMoveOut: () => ({ mutateAsync: executeMutate, isPending: false }),
  useScheduleMoveOut: () => ({ mutateAsync: scheduleMutate, isPending: false }),
  useCancelMoveOutSchedule: () => ({ mutateAsync: cancelMutate, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { MoveOutControl } from "./MoveOutControl";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  executeMutate.mockResolvedValue(undefined);
  scheduleMutate.mockResolvedValue("2026-08-31");
  cancelMutate.mockResolvedValue(undefined);
});

describe("MoveOutControl", () => {
  it("즉시 퇴실은 확인 후 occupancy id와 오늘 날짜로 실행한다", async () => {
    render(<MoveOutControl occupancyId={9} scheduledDate={null} isVacant={false} />);
    fireEvent.click(screen.getByRole("button", { name: "퇴실처리" }));
    fireEvent.click(screen.getByRole("button", { name: "지금 퇴실 확정" }));
    await waitFor(() => expect(executeMutate).toHaveBeenCalledWith(expect.objectContaining({ occupancyId: 9 })));
    expect(executeMutate.mock.calls[0][0].moveOutDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("예약 카드에서 예약 취소를 호출한다", async () => {
    render(<MoveOutControl occupancyId={9} scheduledDate="2026-08-31" isVacant={false} />);
    fireEvent.click(screen.getByRole("button", { name: "퇴실처리" }));
    expect(screen.getByText("2026-08-31 자동 퇴실 예정")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "예약 취소" }));
    await waitFor(() => expect(cancelMutate).toHaveBeenCalledWith(9));
  });
});
