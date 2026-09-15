import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: () => ({ data: { orgId: 9 } }) }));
const roomCreate = vi.fn().mockResolvedValue({});
vi.mock("@/hooks/reactquery/roomTypes", () => ({
  useRoomTypes: () => ({ data: [{ id: 1, label: "원룸" }] }),
  useCreateRoomType: () => ({ mutateAsync: roomCreate }),
  useRenameRoomType: () => ({ mutateAsync: vi.fn() }),
  useDeleteRoomType: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/reactquery/septicVendors", () => ({
  useSepticVendors: () => ({ data: [] }), useCreateSepticVendor: () => ({ mutateAsync: vi.fn() }),
  useRenameSepticVendor: () => ({ mutateAsync: vi.fn() }), useDeleteSepticVendor: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/reactquery/asCategories", () => ({
  useAsCategories: () => ({ data: [] }), useCreateAsCategory: () => ({ mutateAsync: vi.fn() }),
  useRenameAsCategory: () => ({ mutateAsync: vi.fn() }), useDeleteAsCategory: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/reactquery/cleaningTeams", () => ({
  useCleaningTeams: () => ({ data: [] }), useCreateCleaningTeam: () => ({ mutateAsync: vi.fn() }),
  useRenameCleaningTeam: () => ({ mutateAsync: vi.fn() }), useDeleteCleaningTeam: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("./QuickMessageEditor", () => ({ QuickMessageEditor: () => <div>QUICK_MSG</div> }));
vi.mock("@/hooks/common/useAppToast", () => ({ appToast: { error: vi.fn(), success: vi.fn() } }));
import { SystemSettingsTab } from "./SystemSettingsTab";
beforeEach(() => { vi.clearAllMocks(); roomCreate.mockResolvedValue({}); });

describe("SystemSettingsTab", () => {
  it("4 마스터 + 문자를 렌더하고 독립 협력업체 화면은 포함하지 않는다", () => {
    render(<SystemSettingsTab />);
    expect(screen.getByText("룸타입")).toBeInTheDocument();
    expect(screen.getByText("정화조 업체")).toBeInTheDocument();
    expect(screen.getByText("AS 구분")).toBeInTheDocument();
    expect(screen.getByText("청소팀")).toBeInTheDocument();
    expect(screen.getByText("QUICK_MSG")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "협력업체" })).not.toBeInTheDocument();
  });
  it("룸타입 추가 → useCreateRoomType({orgId,label})", async () => {
    render(<SystemSettingsTab />);
    const input = screen.getByLabelText("룸타입 추가");
    fireEvent.change(input, { target: { value: "쓰리룸" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(roomCreate).toHaveBeenCalledWith({ orgId: 9, label: "쓰리룸" }));
  });
});
