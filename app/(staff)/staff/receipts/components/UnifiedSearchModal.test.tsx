/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/movingSettlement", () => ({
  useSettlementInquiry: vi.fn(() => ({ data: [] })),
}));

import { UnifiedSearchModal } from "./UnifiedSearchModal";
import { useSettlementInquiry } from "@/hooks/reactquery/movingSettlement";

const buildings = [
  { id: 2, name: "그린빌라", ownerName: "김소유", ownerPhone: "010-111-2222" },
  { id: 3, name: "블루하우스", ownerName: "박건물", ownerPhone: "010-333-4444" },
] as any;
const receiptRows = [
  {
    unitId: 21,
    buildingId: 2,
    buildingName: "그린빌라",
    dong: "A동",
    unitNo: "101호",
    tenantName: "김입주",
    phone: "010-1234-5678",
    charged: 150000,
    paid: 0,
    unpaid: 150000,
  },
  {
    unitId: 22,
    buildingId: 2,
    buildingName: "그린빌라",
    dong: "A동",
    unitNo: "201호",
    tenantName: "이세입",
    phone: "010-9999-0000",
    charged: 200000,
    paid: 0,
    unpaid: 200000,
  },
] as any;

function renderModal() {
  const onJump = vi.fn();
  const onClose = vi.fn();
  vi.mocked(useSettlementInquiry).mockReturnValue({ data: [] } as any);
  render(
    <UnifiedSearchModal
      open
      onClose={onClose}
      buildings={buildings}
      receiptRows={receiptRows}
      onJump={onJump}
    />,
  );
  return { onJump, onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UnifiedSearchModal", () => {
  it("키워드로 세입자를 찾아 클릭하면 jumpTo(건물, 호실) 후 닫힘", () => {
    const { onJump, onClose } = renderModal();
    fireEvent.change(screen.getByLabelText("통합검색 키워드"), { target: { value: "이세입" } });
    expect(screen.getAllByText("이세입").length).toBeGreaterThan(0);
    expect(screen.queryByText("김입주")).toBeNull();

    fireEvent.click(screen.getAllByText("이세입")[0]);
    expect(onJump).toHaveBeenCalledWith(2, 22);
    expect(onClose).toHaveBeenCalled();
  });

  it("건물주 결과 클릭 시 호실 없이 건물만 jump (unitId=null)", () => {
    const { onJump } = renderModal();
    fireEvent.change(screen.getByLabelText("통합검색 키워드"), { target: { value: "박건물" } });
    fireEvent.click(screen.getByText("박건물"));
    expect(onJump).toHaveBeenCalledWith(3, null);
  });

  it("금액 모드로 전환하면 청구금액을 금액으로 검색", () => {
    const { onJump } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "금액으로 찾기" }));
    fireEvent.change(screen.getByLabelText("통합검색 금액"), { target: { value: "200000" } });
    expect(screen.getByText("이세입")).toBeInTheDocument();
    expect(screen.queryByText("김입주")).toBeNull();

    fireEvent.click(screen.getByText("이세입"));
    expect(onJump).toHaveBeenCalledWith(2, 22);
  });
});
