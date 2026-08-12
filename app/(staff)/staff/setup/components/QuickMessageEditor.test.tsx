import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: () => ({ data: { orgId: 9 } }) }));
const createMut = vi.fn().mockResolvedValue({});
vi.mock("@/hooks/reactquery/quickMessages", () => ({
  useQuickMessages: () => ({ data: [{ id: 1, orgId: 9, title: "인사", body: "안녕하세요", sortOrder: 0 }] }),
  useCreateQuickMessage: () => ({ mutateAsync: createMut, isPending: false }),
  useUpdateQuickMessage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteQuickMessage: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { QuickMessageEditor } from "./QuickMessageEditor";
beforeEach(() => { vi.clearAllMocks(); createMut.mockResolvedValue({}); });

describe("QuickMessageEditor", () => {
  it("목록 렌더", () => {
    render(<QuickMessageEditor />);
    expect(screen.getByText(/인사/)).toBeInTheDocument();
  });
  it("추가: 모달에서 제목·내용 입력 후 저장 → create({orgId,title,body})", async () => {
    render(<QuickMessageEditor />);
    fireEvent.click(screen.getByRole("button", { name: /추가/ }));
    fireEvent.change(screen.getByLabelText("문자 제목"), { target: { value: "공지" } });
    fireEvent.change(screen.getByLabelText("문자 내용"), { target: { value: "내용입니다" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    await waitFor(() => expect(createMut).toHaveBeenCalledWith({ orgId: 9, title: "공지", body: "내용입니다" }));
  });
});
