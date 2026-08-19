import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/utilities", () => ({
  useBillingPeriod: vi.fn(),
  useSaveBillingPeriod: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import {
  useBillingPeriod,
  useSaveBillingPeriod,
} from "@/hooks/reactquery/utilities";
import { BillingPeriodBar } from "./BillingPeriodBar";

const saveMutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useBillingPeriod).mockReturnValue({
    data: null,
    isLoading: false,
    error: null,
  } as never);
  vi.mocked(useSaveBillingPeriod).mockReturnValue({
    mutate: saveMutate,
    isPending: false,
  } as never);
});

describe("BillingPeriodBar", () => {
  it("billing 권한이 있으면 신규 설정을 전월 16일~당월 15일로 제안해 저장한다", () => {
    render(<BillingPeriodBar buildingId={2} period="2026-08-01" canEdit />);

    expect(screen.getByText("부과기준일을 먼저 설정해 주세요.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    expect(screen.getByLabelText("부과 시작일")).toHaveValue("2026-07-16");
    expect(screen.getByLabelText("부과 종료일")).toHaveValue("2026-08-15");
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(saveMutate).toHaveBeenCalledWith(
      {
        buildingId: 2,
        period: "2026-08-01",
        chargeStartDate: "2026-07-16",
        chargeEndDate: "2026-08-15",
      },
      expect.anything(),
    );
    saveMutate.mock.calls[0][1].onSuccess();
    expect(toast.success).toHaveBeenCalledWith("부과기준일을 저장했습니다.");
  });

  it("billing 권한이 없으면 납기일과 관리비 부과 세팅 안내만 표시한다", () => {
    vi.mocked(useBillingPeriod).mockReturnValue({
      data: {
        chargeStartDate: "2026-07-16",
        chargeEndDate: "2026-08-15",
        dueDate: "2026-08-25",
      },
      isLoading: false,
      error: null,
    } as never);

    render(<BillingPeriodBar buildingId={2} period="2026-08-01" canEdit={false} />);

    expect(screen.getByText("2026-07-16 ~ 2026-08-15")).toBeInTheDocument();
    expect(screen.getByText("납기일 2026-08-25")).toBeInTheDocument();
    expect(screen.getByText(/관리비 부과 세팅/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "수정" })).not.toBeInTheDocument();
  });
});
