import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));

const saveMutate = vi.fn();
vi.mock("@/hooks/reactquery/buildings", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/reactquery/buildings")>("@/hooks/reactquery/buildings");
  return {
    ...actual,
    useSaveBuilding: () => ({ mutateAsync: saveMutate }),
    useStaffOptions: () => ({ data: [] }),
    useBuildingFull: () => ({ data: undefined, isLoading: false }),
  };
});
vi.mock("@/hooks/reactquery/attachments", () => ({
  uploadAttachment: vi.fn(async () => ({})),
  deleteAttachment: vi.fn(async () => {}),
  listAttachmentsByEntities: vi.fn(async () => []),
}));
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: () => ({ data: { orgId: 9, role: "org_owner", permissions: [] } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { BuildingForm } from "./BuildingForm";

beforeEach(() => vi.clearAllMocks());

describe("BuildingForm 등록", () => {
  it("필수 미입력 시 저장 안 함(토스트 에러)", async () => {
    render(<BuildingForm />);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(saveMutate).not.toHaveBeenCalled());
  });

  it("기본정보 입력 후 저장 → saveBuilding 호출 + 상세로 replace", async () => {
    saveMutate.mockResolvedValue({ buildingId: 42, vendors: [] });
    render(<BuildingForm />);
    fireEvent.change(screen.getByLabelText("건물명"), { target: { value: "가나빌" } });
    fireEvent.change(screen.getByLabelText("주소"), { target: { value: "서울" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(saveMutate).toHaveBeenCalled());
    const payload = saveMutate.mock.calls[0][0];
    expect(payload).toMatchObject({ name: "가나빌", address: "서울" });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/buildings/42"));
  });
});
