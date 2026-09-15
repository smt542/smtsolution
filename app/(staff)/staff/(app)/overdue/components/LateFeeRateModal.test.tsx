import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LateFeeRateModal } from "./LateFeeRateModal";

const { mutateAsync } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
}));

vi.mock("@/hooks/reactquery/lateFeeTiers", () => {
  const tiers = [
    { id: 1, orgId: 3, tierOrder: 1, fromMonth: 0, toMonth: 1, monthlyRate: 1 },
    { id: 2, orgId: 3, tierOrder: 2, fromMonth: 1, toMonth: 3, monthlyRate: 1.2 },
  ];

  return {
    useLateFeeRateTiers: vi.fn(() => ({ data: tiers, isLoading: false })),
    useReplaceLateFeeRateTiers: vi.fn(() => ({ mutateAsync, isPending: false })),
  };
});

vi.mock("@/hooks/common/useAppToast", () => ({
  appToast: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue(undefined);
});

describe("LateFeeRateModal", () => {
  it("기존 구간을 편집 가능한 행으로 렌더한다", async () => {
    render(<LateFeeRateModal open orgId={3} onClose={vi.fn()} />);

    expect(screen.getByText("연체료 요율 설정")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("1.2")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("구간을 추가하고 삭제할 수 있다", async () => {
    render(<LateFeeRateModal open orgId={3} onClose={vi.fn()} />);
    await screen.findByDisplayValue("1.2");

    fireEvent.click(screen.getByRole("button", { name: "구간 추가" }));
    expect(screen.getAllByRole("row")).toHaveLength(4);

    fireEvent.click(screen.getByRole("button", { name: "3번 구간 삭제" }));
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("편집한 전체 요율표를 순서와 함께 저장한다", async () => {
    const onClose = vi.fn();
    render(<LateFeeRateModal open orgId={3} onClose={onClose} />);
    await screen.findByDisplayValue("1.2");

    fireEvent.change(screen.getByRole("spinbutton", { name: "2번 구간 월요율" }), {
      target: { value: "1.4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        orgId: 3,
        tiers: [
          { tierOrder: 1, fromMonth: 0, toMonth: 1, monthlyRate: 1 },
          { tierOrder: 2, fromMonth: 1, toMonth: 3, monthlyRate: 1.4 },
        ],
      });
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
