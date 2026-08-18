/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push, useReceiptPaymentStatus } = vi.hoisted(() => ({
  push: vi.fn(),
  useReceiptPaymentStatus: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/hooks/reactquery/receipts", () => ({ useReceiptPaymentStatus }));
vi.mock("../../messaging/components/MessagingModal", () => ({
  MessagingModal: ({ preset }: any) => <div role="dialog">{preset.context}:{preset.recipients[0].phone}</div>,
}));

import { PaymentStatusSection } from "./PaymentStatusSection";

const rows = [
  {
    buildingId: 2,
    buildingName: "그린빌라",
    unitId: 21,
    unitNo: "101호",
    dong: "A동",
    occupancyId: 31,
    tenantName: "김입주",
    isVacant: false,
    isAutoDebit: false,
    dueDate: "2026-08-25",
    payerNo: null,
    payerName: null,
    charged: 120_000,
    paid: 50_000,
    unpaid: 70_000,
    payStatus: "partial",
    phone: "010-1111-2222",
    overdueMonths: 1,
    lastPaymentDate: "2026-08-10",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  useReceiptPaymentStatus.mockReturnValue({
    data: {
      rows,
      feeItems: [{
        buildingId: 2,
        buildingName: "그린빌라",
        feeItemId: 1,
        feeItemName: "일반관리비",
        amount: 120_000,
      }],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
});

describe("PaymentStatusSection", () => {
  it("실데이터 컬럼·합계·검색 결과를 표시한다", () => {
    render(<PaymentStatusSection buildings={[{ id: 2, name: "그린빌라" }]} isBuildingsLoading={false} canSendMessages />);

    expect(screen.getByText("김입주")).toBeInTheDocument();
    expect(screen.getAllByText("120,000원").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "빌라별 월간 수납 요약" })).toBeInTheDocument();
    expect(screen.getAllByText("1세대").length).toBeGreaterThan(1);
    expect(screen.getByText("일반관리비 120,000원")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("수납 호실 검색"), { target: { value: "999" } });
    expect(screen.getByText("조건에 맞는 데이터가 없습니다")).toBeInTheDocument();
  });

  it("문자 프리셋과 payment 출력 딥링크를 연다", () => {
    render(<PaymentStatusSection buildings={[{ id: 2, name: "그린빌라" }]} isBuildingsLoading={false} canSendMessages />);

    fireEvent.click(screen.getByRole("button", { name: "고지서 문자 전송" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("고지서:010-1111-2222");

    fireEvent.click(screen.getByRole("button", { name: "영수증 출력" }));
    expect(push).toHaveBeenCalledWith(expect.stringMatching(
      /^\/staff\/payment\?buildingId=2&unitId=21&period=.*&view=receipt$/,
    ));
  });
});
