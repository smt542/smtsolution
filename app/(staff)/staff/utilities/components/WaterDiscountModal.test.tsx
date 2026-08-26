import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/utilities", () => ({
  useSaveWaterDiscount: vi.fn(),
  useDeleteWaterDiscount: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  useSaveWaterDiscount,
  useDeleteWaterDiscount,
  type UtilityUnitRow,
} from "@/hooks/reactquery/utilities";
import { WaterDiscountModal } from "./WaterDiscountModal";

const baseRow: UtilityUnitRow = {
  unitId: 101,
  unitNo: "101호",
  dong: null,
  occupancyId: 1,
  tenantName: "김수급",
  occupancyStatus: "occupied",
  moveInDate: null,
  customerNumber: null,
  meterNumber: null,
  previousReading: null,
  currentReading: null,
  usage: null,
  unitPrice: null,
  resolvedUnitPrice: null,
  automaticCharge: null,
  manualCharge: null,
  note: null,
  processedAt: null,
  discountType: null,
  discountAmount: null,
};

const saveMutate = vi.fn();
const deleteMutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useSaveWaterDiscount).mockReturnValue({ mutate: saveMutate, isPending: false } as never);
  vi.mocked(useDeleteWaterDiscount).mockReturnValue({ mutate: deleteMutate, isPending: false } as never);
});

describe("WaterDiscountModal", () => {
  it("구분·금액을 입력해 저장하면 saveWaterDiscount를 호출한다", () => {
    render(<WaterDiscountModal open buildingId={7} period="2026-08-01" row={baseRow} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("할인 구분"), { target: { value: "recipient" } });
    fireEvent.change(screen.getByLabelText("할인 금액"), { target: { value: "3000" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({ buildingId: 7, period: "2026-08-01", unitId: 101, discountType: "recipient", amount: 3000 }),
      expect.anything(),
    );
  });

  it("기존 할인 세대에서 해제하면 deleteWaterDiscount를 호출한다", () => {
    const withDiscount: UtilityUnitRow = { ...baseRow, discountType: "recipient", discountAmount: 3000 };
    render(<WaterDiscountModal open buildingId={7} period="2026-08-01" row={withDiscount} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "할인 해제" }));

    expect(deleteMutate).toHaveBeenCalledWith(
      { buildingId: 7, period: "2026-08-01", unitId: 101 },
      expect.anything(),
    );
  });

  it("음수 금액은 저장하지 않는다", () => {
    render(<WaterDiscountModal open buildingId={7} period="2026-08-01" row={baseRow} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("할인 금액"), { target: { value: "-1" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(saveMutate).not.toHaveBeenCalled();
  });
});
