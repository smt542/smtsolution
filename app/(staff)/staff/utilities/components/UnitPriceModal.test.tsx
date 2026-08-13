import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/utilities", () => ({
  useUtilityPrices: vi.fn(),
  useSaveUtilityUnitPrices: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  useSaveUtilityUnitPrices,
  useUtilityPrices,
} from "@/hooks/reactquery/utilities";
import { UnitPriceModal } from "./UnitPriceModal";

const saveMutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useSaveUtilityUnitPrices).mockReturnValue({
    mutate: saveMutate,
    isPending: false,
  } as never);
});

describe("UnitPriceModal", () => {
  it("고객번호별 기존 단가를 표시하고 입력한 행을 저장한다", () => {
    vi.mocked(useUtilityPrices).mockReturnValue({
      data: [
        {
          customerNumberId: 11,
          customerNo: "W-APT",
          holderName: "주택용",
          sortOrder: 0,
          unitPrice: 850,
        },
        {
          customerNumberId: 12,
          customerNo: "W-SHOP",
          holderName: "상가용",
          sortOrder: 1,
          unitPrice: null,
        },
      ],
      isLoading: false,
      error: null,
    } as never);

    render(
      <UnitPriceModal
        open
        buildingId={3}
        utilityType="water"
        onClose={() => {}}
      />,
    );

    expect(screen.getByLabelText("W-APT 단가")).toHaveValue(850);
    fireEvent.change(screen.getByLabelText("W-SHOP 단가"), {
      target: { value: "920.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(saveMutate).toHaveBeenCalledWith(
      {
        buildingId: 3,
        utilityType: "water",
        prices: [
          { customer_number_id: 11, unit_price: 850 },
          { customer_number_id: 12, unit_price: 920.5 },
        ],
      },
      expect.anything(),
    );
  });

  it("고객번호가 없으면 건물 상세 등록 안내를 표시한다", () => {
    vi.mocked(useUtilityPrices).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as never);

    render(
      <UnitPriceModal
        open
        buildingId={3}
        utilityType="gas"
        onClose={() => {}}
      />,
    );

    expect(screen.getByText(/건물 상세에서 고객번호를 먼저 등록/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("음수 단가는 저장하지 않는다", () => {
    vi.mocked(useUtilityPrices).mockReturnValue({
      data: [{
        customerNumberId: 11,
        customerNo: "G-1",
        holderName: null,
        sortOrder: 0,
        unitPrice: null,
      }],
      isLoading: false,
      error: null,
    } as never);

    render(
      <UnitPriceModal
        open
        buildingId={3}
        utilityType="gas"
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("G-1 단가"), { target: { value: "-1" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(saveMutate).not.toHaveBeenCalled();
  });
});
