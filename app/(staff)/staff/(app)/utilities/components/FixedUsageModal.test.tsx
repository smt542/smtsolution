import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/utilities", () => ({
  useSetFixedUsage: vi.fn(),
  useClearFixedUsage: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  useClearFixedUsage,
  useSetFixedUsage,
} from "@/hooks/reactquery/utilities";
import { FixedUsageModal } from "./FixedUsageModal";

const setMutate = vi.fn();
const clearMutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useSetFixedUsage).mockReturnValue({
    mutate: setMutate,
    isPending: false,
  } as never);
  vi.mocked(useClearFixedUsage).mockReturnValue({
    mutate: clearMutate,
    isPending: false,
  } as never);
});

describe("FixedUsageModal", () => {
  it("고정 사용량을 저장하면 세대·유형·사용량으로 설정 훅을 호출한다", () => {
    render(
      <FixedUsageModal
        open
        buildingId={3}
        unitId={101}
        unitNo="101호"
        utility="electricity"
        currentFixedUsage={null}
        onSaved={() => {}}
        onClose={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText("고정 사용량"), {
      target: { value: "12.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(setMutate).toHaveBeenCalledWith(
      {
        buildingId: 3,
        unitId: 101,
        utilityType: "electricity",
        fixedUsage: 12.5,
      },
      expect.anything(),
    );
  });

  it("기존 고정 사용량을 해제하면 세대·유형으로 해제 훅을 호출한다", () => {
    render(
      <FixedUsageModal
        open
        buildingId={3}
        unitId={101}
        unitNo="101호"
        utility="gas"
        currentFixedUsage={20}
        onSaved={() => {}}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "고정 사용량 해제" }));

    expect(clearMutate).toHaveBeenCalledWith(
      { buildingId: 3, unitId: 101, utilityType: "gas" },
      expect.anything(),
    );
  });

  it("가스만 적용 시작월을 기존 값으로 표시하고 월초 날짜로 저장한다", () => {
    render(
      <FixedUsageModal
        open
        buildingId={3}
        unitId={101}
        unitNo="101호"
        utility="gas"
        currentFixedUsage={20}
        currentFixedUsageFrom="2026-08-01"
        onSaved={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByLabelText("적용 시작월")).toHaveValue("2026-08");
    fireEvent.change(screen.getByLabelText("적용 시작월"), {
      target: { value: "2026-09" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(setMutate).toHaveBeenCalledWith(
      {
        buildingId: 3,
        unitId: 101,
        utilityType: "gas",
        fixedUsage: 20,
        fixedUsageFrom: "2026-09-01",
      },
      expect.anything(),
    );
  });

  it("전기에는 적용 시작월을 표시하거나 payload에 추가하지 않는다", () => {
    render(
      <FixedUsageModal
        open
        buildingId={3}
        unitId={101}
        unitNo="101호"
        utility="electricity"
        currentFixedUsage={20}
        currentFixedUsageFrom="2026-08-01"
        onSaved={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.queryByLabelText("적용 시작월")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(setMutate.mock.calls[0][0]).toEqual({
      buildingId: 3,
      unitId: 101,
      utilityType: "electricity",
      fixedUsage: 20,
    });
  });
});
