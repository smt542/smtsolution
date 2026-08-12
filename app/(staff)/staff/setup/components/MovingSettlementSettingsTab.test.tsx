import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/setupConfig", () => ({ useSetupConfig: vi.fn(), useUpsertSetupConfig: vi.fn() }));
vi.mock("@/hooks/reactquery/settlementCheckItems", () => ({
  useSettlementCheckItems: vi.fn(), useCreateSettlementCheckItem: vi.fn(),
  useRenameSettlementCheckItem: vi.fn(), useDeleteSettlementCheckItem: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { MovingSettlementSettingsTab } from "./MovingSettlementSettingsTab";
import { useMe } from "@/hooks/reactquery/auth";
import { useSetupConfig, useUpsertSetupConfig } from "@/hooks/reactquery/setupConfig";
import * as sci from "@/hooks/reactquery/settlementCheckItems";

const upsertMut = vi.fn().mockResolvedValue({});
const createMut = vi.fn().mockResolvedValue({});
beforeEach(() => {
  vi.clearAllMocks(); upsertMut.mockResolvedValue({}); createMut.mockResolvedValue({});
  vi.mocked(useMe).mockReturnValue({ data: { orgId: 9 } } as any);
  vi.mocked(useUpsertSetupConfig).mockReturnValue({ mutateAsync: upsertMut, isPending: false } as any);
  vi.mocked(useSetupConfig).mockReturnValue({ data: { waterUnitReflect: true, electricUnitReflect: false, vacancyPaymentMode: "auto" } } as any);
  vi.mocked(sci.useSettlementCheckItems).mockReturnValue({ data: [{ id: 1, orgId: 9, label: "도배", sortOrder: 0 }] } as any);
  vi.mocked(sci.useCreateSettlementCheckItem).mockReturnValue({ mutateAsync: createMut, isPending: false } as any);
  vi.mocked(sci.useRenameSettlementCheckItem).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
  vi.mocked(sci.useDeleteSettlementCheckItem).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
});

describe("MovingSettlementSettingsTab", () => {
  it("config 저장: 3개 필드 patch", async () => {
    render(<MovingSettlementSettingsTab />);
    expect(screen.getByLabelText("공실 처리 시 수납 방식")).toHaveValue("auto");
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => {
      expect(upsertMut).toHaveBeenCalledWith({ orgId: 9, patch: { waterUnitReflect: true, electricUnitReflect: false, vacancyPaymentMode: "auto" } });
    });
  });
  it("체크항목 추가 → createItem({orgId,label})", async () => {
    render(<MovingSettlementSettingsTab />);
    expect(screen.getByText("도배")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("이사정산 체크항목 추가"), { target: { value: "청소" } });
    fireEvent.click(screen.getByRole("button", { name: /추가/ }));
    await waitFor(() => expect(createMut).toHaveBeenCalledWith({ orgId: 9, label: "청소" }));
  });
});
