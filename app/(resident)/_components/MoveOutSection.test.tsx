import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const moveOut = vi.hoisted(() => ({
  useCancelMoveOut: vi.fn(),
  useCreateMoveOut: vi.fn(),
  useMoveOutRequest: vi.fn(),
  useUpdateMoveOut: vi.fn(),
}));
vi.mock("@/hooks/reactquery/residentMoveOut", () => moveOut);

import MoveOutSection from "./MoveOutSection";

const create = vi.fn();
const update = vi.fn();
const cancel = vi.fn();
const refetch = vi.fn();

const pendingRequest = {
  id: 1,
  desiredDate: "2026-09-30",
  reason: "이사",
  status: "pending",
  createdAt: "2026-08-19T00:00:00Z",
  updatedAt: "2026-08-19T00:00:00Z",
  canceledAt: null,
  resolvedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  moveOut.useMoveOutRequest.mockReturnValue({
    data: null,
    error: null,
    isPending: false,
    refetch,
  });
  moveOut.useCreateMoveOut.mockReturnValue({ mutateAsync: create, isPending: false });
  moveOut.useUpdateMoveOut.mockReturnValue({ mutateAsync: update, isPending: false });
  moveOut.useCancelMoveOut.mockReturnValue({ mutateAsync: cancel, isPending: false });
  create.mockResolvedValue(1);
  update.mockResolvedValue(undefined);
  cancel.mockResolvedValue(undefined);
  refetch.mockResolvedValue({ data: null });
});

describe("MoveOutSection", () => {
  it("creates a request and shows the receipt confirmation", async () => {
    const user = userEvent.setup();
    render(<MoveOutSection open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/희망 퇴실일/), "2026-09-30");
    await user.type(screen.getByLabelText(/사유/), "직장 이동");
    await user.click(screen.getByRole("button", { name: "퇴실 신청하기" }));

    await waitFor(() => expect(create).toHaveBeenCalledWith({
      desiredDate: "2026-09-30",
      reason: "직장 이동",
    }));
    expect(screen.getByRole("dialog", { name: "퇴실 신청이 접수됐어요" })).toBeInTheDocument();
  });

  it("검증 실패 시 날짜 필드에 포커스하고 ARIA로 오류를 연결한다", async () => {
    const user = userEvent.setup();
    render(<MoveOutSection open onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "퇴실 신청하기" }));
    const date = screen.getByLabelText(/희망 퇴실일/);
    await waitFor(() => expect(date).toHaveFocus());
    expect(date).toHaveAttribute("aria-invalid", "true");
    expect(date).toHaveAttribute("aria-describedby", "move-out-desired-date-error");
    expect(create).not.toHaveBeenCalled();
  });

  it("서버 실패는 전역 오류로 표시하고 화면을 유지한다", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    create.mockRejectedValue(new Error("퇴실 신청 저장 실패"));
    render(<MoveOutSection open onClose={onClose} />);

    await user.type(screen.getByLabelText(/희망 퇴실일/), "2026-09-30");
    await user.click(screen.getByRole("button", { name: "퇴실 신청하기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("퇴실 신청 저장 실패");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("edits a pending date and confirms cancellation through a warning", async () => {
    const user = userEvent.setup();
    moveOut.useMoveOutRequest.mockReturnValue({
      data: pendingRequest,
      error: null,
      isPending: false,
      refetch,
    });
    render(<MoveOutSection open onClose={vi.fn()} />);

    expect(screen.getByText("담당자가 확인 중이에요")).toBeInTheDocument();
    expect(screen.getByText("2026.09.30")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "희망 퇴실일 변경" }));
    const dateInput = screen.getByLabelText("새 희망 퇴실일");
    await user.clear(dateInput);
    await user.type(dateInput, "2026-10-05");
    await user.click(screen.getByRole("button", { name: "변경 저장" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("2026-10-05"));

    await user.click(screen.getByRole("button", { name: "신청 취소" }));
    const dialog = screen.getByRole("dialog", { name: "퇴실 신청을 취소할까요?" });
    expect(within(dialog).getByText(/담당자가 확인 중인 신청이 종료/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "신청 취소" }));
    await waitFor(() => expect(cancel).toHaveBeenCalledOnce());
  });

  it("refetches and suppresses a hard error when a pending request already exists", async () => {
    const user = userEvent.setup();
    create.mockRejectedValue(new Error("pending move-out request already exists"));
    refetch.mockResolvedValue({ data: pendingRequest });
    render(<MoveOutSection open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/희망 퇴실일/), "2026-09-30");
    await user.click(screen.getByRole("button", { name: "퇴실 신청하기" }));

    await waitFor(() => expect(refetch).toHaveBeenCalledOnce());
    expect(screen.queryByText("pending move-out request already exists")).not.toBeInTheDocument();
  });
});
