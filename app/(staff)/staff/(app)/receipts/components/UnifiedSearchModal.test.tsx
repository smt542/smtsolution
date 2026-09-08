/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/movingSettlement", () => ({
  useSettlementInquiry: vi.fn(() => ({ data: { rows: [] } })),
}));

import { UnifiedSearchModal } from "./UnifiedSearchModal";
import { useSettlementInquiry } from "@/hooks/reactquery/movingSettlement";

const buildings = [
  { id: 2, code: "001", name: "그린빌라", address: "서울 A", ownerName: "김소유", ownerPhone: "010-111-2222" },
  { id: 3, code: "002", name: "블루하우스", address: "서울 B", ownerName: "박건물", ownerPhone: "010-333-4444" },
] as any;
const receiptRows = [
  {
    unitId: 21,
    buildingId: 2,
    buildingName: "그린빌라",
    dong: "A동",
    unitNo: "101호",
    tenantName: "김입주",
    payerName: "김입주",
    phone: "010-1234-5678",
    charged: 150000,
    paid: 0,
    unpaid: 150000,
    lastPaymentDate: null,
  },
  {
    unitId: 22,
    buildingId: 2,
    buildingName: "그린빌라",
    dong: "A동",
    unitNo: "201호",
    tenantName: "이세입",
    payerName: "이세입",
    phone: "010-9999-0000",
    charged: 200000,
    paid: 0,
    unpaid: 200000,
    lastPaymentDate: null,
  },
] as any;

function renderModal() {
  const onJump = vi.fn();
  const onClose = vi.fn();
  vi.mocked(useSettlementInquiry).mockReturnValue({ data: { rows: [] } } as any);
  render(
    <UnifiedSearchModal
      open
      onClose={onClose}
      buildings={buildings}
      receiptRows={receiptRows}
      period="2026-08-01"
      onJump={onJump}
    />,
  );
  return { onJump, onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UnifiedSearchModal", () => {
  it("입금자명으로 세입자를 찾아 클릭하면 jumpTo(건물, 호실) 후 닫힘", () => {
    const { onJump, onClose } = renderModal();
    fireEvent.change(screen.getByLabelText("입금자명"), { target: { value: "이세입" } });
    fireEvent.click(screen.getByRole("button", { name: "입금자명으로 조회" }));

    expect(screen.getAllByText("이세입").length).toBeGreaterThan(0);
    expect(screen.queryByText("김입주")).toBeNull();

    fireEvent.click(screen.getAllByText("이세입")[0]);
    expect(onJump).toHaveBeenCalledWith(2, 22);
    expect(onClose).toHaveBeenCalled();
  });

  it("건물주 결과 클릭 시 호실 없이 건물만 jump (unitId=null)", () => {
    const { onJump } = renderModal();
    fireEvent.change(screen.getByLabelText("입금자명"), { target: { value: "박건물" } });
    fireEvent.click(screen.getByRole("button", { name: "입금자명으로 조회" }));

    fireEvent.click(screen.getByText("박건물"));
    expect(onJump).toHaveBeenCalledWith(3, null);
  });

  it("금액으로 청구금액을 검색해 결과를 클릭하면 jump", () => {
    const { onJump } = renderModal();
    fireEvent.change(screen.getByLabelText("금액"), { target: { value: "200000" } });
    fireEvent.click(screen.getByRole("button", { name: "금액으로 조회" }));

    expect(screen.getByText("이세입")).toBeInTheDocument();
    expect(screen.queryByText("김입주")).toBeNull();

    fireEvent.click(screen.getByText("이세입"));
    expect(onJump).toHaveBeenCalledWith(2, 22);
  });
});
