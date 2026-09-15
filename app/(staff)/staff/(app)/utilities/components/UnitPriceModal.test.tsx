import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/utilities", () => ({
  useScopedPrices: vi.fn(),
  useSaveScopedPrices: vi.fn(),
  useUtilityPrices: vi.fn(),
  useSaveUtilityUnitPrices: vi.fn(),
}));
vi.mock("@/hooks/common/useAppToast", () => ({ appToast: { success: vi.fn(), error: vi.fn() } }));

import {
  useSaveScopedPrices,
  useSaveUtilityUnitPrices,
  useScopedPrices,
  useUtilityPrices,
} from "@/hooks/reactquery/utilities";
import { UnitPriceModal } from "./UnitPriceModal";

const saveMutate = vi.fn();
const saveScopedMutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useSaveUtilityUnitPrices).mockReturnValue({
    mutate: saveMutate,
    isPending: false,
  } as never);
  vi.mocked(useScopedPrices).mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
  } as never);
  vi.mocked(useSaveScopedPrices).mockReturnValue({
    mutate: saveScopedMutate,
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

  it("용도별로 전체·층 단가 행을 표시하고 별도로 저장한다", () => {
    vi.mocked(useUtilityPrices).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(useScopedPrices).mockReturnValue({
      data: [
        { usage_type: "residential", floor: null, unit_price: 850 },
        { usage_type: "commercial", floor: 2, unit_price: 920.5 },
      ],
      isLoading: false,
      error: null,
    } as never);

    render(
      <UnitPriceModal
        open
        buildingId={3}
        utilityType="electricity"
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "주거" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "상가" })).toBeInTheDocument();
    expect(screen.getByLabelText("주거 1 층")).toHaveValue(null);
    expect(screen.getByLabelText("상가 1 층")).toHaveValue(2);
    fireEvent.click(screen.getByRole("button", { name: "주거 행 추가" }));
    fireEvent.change(screen.getByLabelText("주거 2 층"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("주거 2 단가"), { target: { value: "875" } });
    fireEvent.click(screen.getByRole("button", { name: "용도/층별 단가 저장" }));

    expect(saveScopedMutate).toHaveBeenCalledWith(
      {
        buildingId: 3,
        utilityType: "electricity",
        rows: [
          { usage_type: "residential", floor: null, unit_price: 850 },
          { usage_type: "residential", floor: 3, unit_price: 875 },
          { usage_type: "commercial", floor: 2, unit_price: 920.5 },
        ],
      },
      expect.anything(),
    );
  });

  it("용도/층 단가 행을 추가하고 제거한다", () => {
    vi.mocked(useUtilityPrices).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as never);

    render(
      <UnitPriceModal open buildingId={3} utilityType="gas" onClose={() => {}} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "상가 행 추가" }));
    expect(screen.getByLabelText("상가 1 단가")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "상가 1행 삭제" }));
    expect(screen.queryByLabelText("상가 1 단가")).not.toBeInTheDocument();
  });
});
