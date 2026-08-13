// app/(staff)/staff/bill/page.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({
  useBuildings: () => ({ data: [{ id: 7, name: "행복빌라" }] }),
}));
vi.mock("@/hooks/reactquery/setupConfig", () => ({
  useSetupConfig: () => ({
    data: { unitLabelDefault: "code", mgmtPrint1: false, mgmtPrint2: false },
  }),
}));
vi.mock("@/hooks/reactquery/bill", () => ({
  useBillTargets: vi.fn(() => ({ data: [], isLoading: false })),
  useBillDocuments: () => ({ data: [] }),
  useIssueBills: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock(
  "@/app/(staff)/staff/messaging/components/MessagingModal",
  () => ({ MessagingModal: () => null }),
);

import BillPage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
import { useBillTargets } from "@/hooks/reactquery/bill";

beforeEach(() => vi.clearAllMocks());

describe("BillPage 게이트", () => {
  it("bill_publish 권한 없으면 차단", () => {
    vi.mocked(useMe).mockReturnValue({
      data: { role: "field_staff", permissions: [] },
    } as unknown as ReturnType<typeof useMe>);
    render(<BillPage />);
    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
  });

  it("권한 있으면 건물 선택 노출·초기 안내", () => {
    vi.mocked(useMe).mockReturnValue({
      data: { role: "staff", orgId: 1, permissions: ["bill_publish"] },
    } as unknown as ReturnType<typeof useMe>);
    render(<BillPage />);
    // select option + empty-state div 모두 "건물을 선택" 텍스트 포함 — 하나 이상 존재하면 충분
    expect(screen.getAllByText(/건물을 선택/).length).toBeGreaterThan(0);
  });

  it("건물 선택 후 확정 세대 없으면 빈 안내", () => {
    vi.mocked(useMe).mockReturnValue({
      data: { role: "staff", orgId: 1, permissions: ["bill_publish"] },
    } as unknown as ReturnType<typeof useMe>);
    vi.mocked(useBillTargets).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useBillTargets>);
    render(<BillPage />);
    // 건물 선택
    fireEvent.change(screen.getByRole("combobox", { name: /건물 선택/ }), {
      target: { value: "7" },
    });
    expect(
      screen.getByText(/부과 확정된 세대가 없습니다/),
    ).toBeInTheDocument();
  });
});
