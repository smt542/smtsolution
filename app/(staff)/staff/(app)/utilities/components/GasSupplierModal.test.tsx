import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/utilities", () => ({
  useUtilitySupplier: vi.fn(),
  useSaveUtilitySupplier: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import {
  useSaveUtilitySupplier,
  useUtilitySupplier,
} from "@/hooks/reactquery/utilities";
import { GasSupplierModal } from "./GasSupplierModal";

const saveMutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useUtilitySupplier).mockReturnValue({
    data: {
      companyName: "서울도시가스",
      phone: "02-1234-5678",
      bank: "국민은행",
      accountNo: "123-456",
      accountHolder: "서울가스",
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useSaveUtilitySupplier).mockReturnValue({
    mutate: saveMutate,
    isPending: false,
  } as never);
});

describe("GasSupplierModal", () => {
  it("기존 공급자정보를 불러와 수정 저장하고 닫는다", () => {
    const onClose = vi.fn();
    render(
      <GasSupplierModal open buildingId={7} onClose={onClose} />,
    );

    expect(screen.getByLabelText("가스회사명")).toHaveValue("서울도시가스");
    expect(screen.getByLabelText("계좌번호")).toHaveValue("123-456");
    fireEvent.change(screen.getByLabelText("전화"), {
      target: { value: "02-9999-0000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(saveMutate).toHaveBeenCalledWith(
      {
        buildingId: 7,
        utilityType: "gas",
        companyName: "서울도시가스",
        phone: "02-9999-0000",
        bank: "국민은행",
        accountNo: "123-456",
        accountHolder: "서울가스",
      },
      expect.anything(),
    );

    saveMutate.mock.calls[0][1].onSuccess();
    expect(toast.success).toHaveBeenCalledWith("가스 공급자정보를 저장했습니다.");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
