import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MessagingPreset } from "@/lib/messaging/preset";

const { messagingModalSpy } = vi.hoisted(() => ({
  messagingModalSpy: vi.fn(),
}));

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/overdue", () => ({
  useOverdueBuildings: vi.fn(),
  useOverdueHouseholds: vi.fn(),
}));
vi.mock("../messaging/components/MessagingModal", () => ({
  MessagingModal: (props: {
    open: boolean;
    preset?: MessagingPreset;
    onClose: () => void;
    onSent?: (result: { logId: number; count: number }) => void;
  }) => {
    messagingModalSpy(props);
    return props.open ? (
      <button
        type="button"
        onClick={() => props.onSent?.({ logId: 91, count: 1 })}
      >
        테스트 발송 완료
      </button>
    ) : null;
  },
}));
vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock("./utils", async () => {
  const actual = await vi.importActual<typeof import("./utils")>("./utils");
  return { ...actual, downloadOverdueLedger: vi.fn(() => "그린빌라_미납대장_202608.csv") };
});

import OverduePage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
import {
  useOverdueBuildings,
  useOverdueHouseholds,
} from "@/hooks/reactquery/overdue";
import { toast } from "sonner";
import { downloadOverdueLedger } from "./utils";

const buildings = [
  { id: 1, code: "B001", name: "그린빌라", address: "서울시 강남구" },
];

const households = [
  {
    occupancyId: 31,
    buildingId: 1,
    buildingName: "그린빌라",
    buildingAddress: "서울시 강남구",
    unitId: 21,
    unitNo: "101호",
    dong: null,
    areaPyeong: 18,
    roomCount: 2,
    tenantName: "김입주",
    payerName: "김납부",
    phone: "010-1111-2222",
    residentCount: 2,
    vehicleNo: "12가3456",
    moveInDate: "2025-01-02",
    moveOutDate: null,
    status: "occupied",
    memo: "메모",
    unitMemo: null,
    overdueMonths: 4,
    overdueAmount: 200_000,
    lastPaymentDate: "2026-03-31",
    billingAvailable: true,
  },
  {
    occupancyId: 32,
    buildingId: 1,
    buildingName: "그린빌라",
    buildingAddress: "서울시 강남구",
    unitId: 22,
    unitNo: "202호",
    dong: null,
    areaPyeong: 20,
    roomCount: 3,
    tenantName: "이입주",
    payerName: null,
    phone: "010-3333-4444",
    residentCount: 1,
    vehicleNo: null,
    moveInDate: "2025-02-03",
    moveOutDate: null,
    status: "occupied",
    memo: null,
    unitMemo: null,
    overdueMonths: 2,
    overdueAmount: 90_000,
    lastPaymentDate: null,
    billingAvailable: true,
  },
] as const;

function setup({
  allowed = true,
  canMessage = true,
}: {
  allowed?: boolean;
  canMessage?: boolean;
} = {}) {
  vi.mocked(useMe).mockReturnValue({
    data: {
      role: "staff",
      permissions: [
        ...(allowed ? ["overdue"] : []),
        ...(canMessage ? ["messaging"] : []),
      ],
    },
    isLoading: false,
  } as never);
  vi.mocked(useOverdueBuildings).mockReturnValue({
    data: buildings,
    isLoading: false,
  } as never);
  vi.mocked(useOverdueHouseholds).mockReturnValue({
    data: households,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as never);
}

function selectBuilding() {
  fireEvent.change(screen.getByRole("combobox", { name: "건물 선택" }), {
    target: { value: "1" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setup();
});

describe("OverduePage", () => {
  it("초기 화면은 건물 선택 안내와 주요 액션을 렌더한다", () => {
    render(<OverduePage />);
    expect(screen.getByRole("heading", { name: "미납관리" })).toBeInTheDocument();
    expect(screen.getByText("건물을 선택해 주세요", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "미납대장 출력" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "독촉 문자 발송" })).toBeDisabled();
  });

  it("overdue 권한이 없으면 페이지 내용을 노출하지 않는다", () => {
    setup({ allowed: false });
    render(<OverduePage />);
    expect(screen.getByText("권한이 없습니다")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "미납관리" })).not.toBeInTheDocument();
  });

  it("overdue 권한만 있으면 독촉 문자 발송 액션을 사용할 수 없다", () => {
    setup({ canMessage: false });
    render(<OverduePage />);
    selectBuilding();
    fireEvent.click(screen.getByRole("checkbox", { name: "101호 선택" }));

    const sendButton = screen.getByRole("button", {
      name: "독촉 문자 발송 (1)",
    });
    expect(sendButton).toBeDisabled();
    expect(sendButton).toHaveAttribute("title", "문자 발송 권한이 필요합니다.");
    expect(messagingModalSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ open: true }),
    );
  });

  it("건물 선택 후 세대 목록을 표시하고 채권 필터를 AND 조건으로 적용한다", () => {
    render(<OverduePage />);
    selectBuilding();
    expect(screen.getByText("101호")).toBeInTheDocument();
    expect(screen.getByText("202호")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "채권 관리 필터" }));

    expect(screen.getByText("101호")).toBeInTheDocument();
    expect(screen.queryByText("202호")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "채권 관리 필터" })).toHaveAttribute("aria-pressed", "true");
  });

  it("조회 연월과 전체·당계 범위를 미납 조회 훅에 전달한다", () => {
    render(<OverduePage />);
    selectBuilding();

    fireEvent.change(screen.getByLabelText("조회 기간"), {
      target: { value: "2026-07" },
    });
    expect(useOverdueHouseholds).toHaveBeenLastCalledWith(1, {
      year: 2026,
      month: 7,
      scope: "all",
    });

    fireEvent.change(screen.getByRole("combobox", { name: "범위" }), {
      target: { value: "current" },
    });
    expect(useOverdueHouseholds).toHaveBeenLastCalledWith(1, {
      year: 2026,
      month: 7,
      scope: "current",
    });
    expect(screen.getByText("연체 2개월 이상 AND 미납 10만원 이상")).toBeInTheDocument();
  });

  it("전체 선택과 개별 선택을 문자 수신 대상에 반영한다", () => {
    render(<OverduePage />);
    selectBuilding();
    fireEvent.click(screen.getByRole("checkbox", { name: "전체 세대 선택" }));
    expect(screen.getByRole("button", { name: "독촉 문자 발송 (2)" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "202호 선택" }));
    expect(screen.getByRole("button", { name: "독촉 문자 발송 (1)" })).toBeInTheDocument();
  });

  it("선택 없이 독촉 문자 버튼을 누르면 안내 토스트를 표시한다", () => {
    render(<OverduePage />);
    selectBuilding();
    fireEvent.click(screen.getByRole("button", { name: "독촉 문자 발송" }));
    expect(toast.info).toHaveBeenCalledWith("문자를 받을 세대를 선택해 주세요.");
    expect(messagingModalSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ open: true }),
    );
  });

  it("overdue와 messaging 권한이 모두 있으면 독촉 발송 모달을 연다", () => {
    setup({ allowed: true, canMessage: true });
    render(<OverduePage />);
    selectBuilding();
    fireEvent.click(screen.getByRole("checkbox", { name: "101호 선택" }));
    fireEvent.click(screen.getByRole("button", { name: "독촉 문자 발송 (1)" }));

    expect(screen.getByRole("button", { name: "테스트 발송 완료" })).toBeInTheDocument();
    expect(messagingModalSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        preset: {
          context: "독촉",
          channel: "sms",
          body: "미납 관리비를 확인해 주세요.",
          recipients: [
            {
              name: "김입주",
              phone: "010-1111-2222",
              unitNo: "101호",
              kind: "tenant",
              ref: { occupancyId: 31 },
            },
          ],
        },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "테스트 발송 완료" }));

    expect(toast.success).toHaveBeenCalledWith(
      "독촉 문자 임시 발송 기록 1건을 생성했습니다. 실제 문자는 발송되지 않았습니다.",
    );
    expect(messagingModalSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ open: false }),
    );
  });

  it("미납대장 출력은 현재 필터 결과와 건물명을 다운로드 함수에 전달한다", () => {
    render(<OverduePage />);
    selectBuilding();
    fireEvent.click(screen.getByRole("button", { name: "채권 관리 필터" }));
    fireEvent.click(screen.getByRole("button", { name: "미납대장 출력" }));
    expect(downloadOverdueLedger).toHaveBeenCalledWith("그린빌라", [households[0]]);
    expect(toast.success).toHaveBeenCalledWith("그린빌라_미납대장_202608.csv 파일을 저장했습니다.");
  });

  it("행을 클릭하면 실제 세대 정보와 미납 정보 상세를 연다", () => {
    render(<OverduePage />);
    selectBuilding();
    fireEvent.click(screen.getByText("101호"));

    expect(screen.getByText("101호 상세")).toBeInTheDocument();
    expect(screen.getByText("세대 정보")).toBeInTheDocument();
    expect(screen.getByText("입주자 정보")).toBeInTheDocument();
    expect(screen.getByText("입주 정보")).toBeInTheDocument();
    expect(screen.getByText("미납 정보")).toBeInTheDocument();
    expect(screen.getAllByText("200,000원")).toHaveLength(2);
  });
});
