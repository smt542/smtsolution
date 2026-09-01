import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MessagingPreset } from "@/lib/messaging/preset";

const { messagingModalSpy, mintBillTokens } = vi.hoisted(() => ({
  messagingModalSpy: vi.fn(),
  mintBillTokens: vi.fn(),
}));

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/org/useOrgContact", () => ({
  useOrgContact: () => ({ data: { phone: "02-9876-5432" } }),
}));
vi.mock("@/hooks/reactquery/lateFeeTiers", () => ({
  useLateFeeRateTiers: vi.fn(),
}));
vi.mock("@/hooks/reactquery/overdue", () => ({
  useOverdueBuildings: vi.fn(),
  useOverdueHouseholds: vi.fn(),
  useOverduePeriods: vi.fn(),
}));
vi.mock("@/hooks/reactquery/residentBilling", () => ({
  useStaffMintBillTokens: () => ({
    mutateAsync: mintBillTokens,
    isPending: false,
  }),
}));
vi.mock("../messaging/components/MessagingModal", () => ({
  MessagingModal: (props: {
    open: boolean;
    preset?: MessagingPreset;
    presentation?: "modal" | "workspace";
    itemCount?: number;
    onClose: () => void;
    onSent?: (result: { logId: number; count: number }) => void;
  }) => {
    messagingModalSpy(props);
    return props.open ? (
      <button type="button" onClick={() => props.onSent?.({ logId: 91, count: 1 })}>
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
  return {
    ...actual,
    downloadOverdueLedger: vi.fn(() => "그린빌라_미납대장_202609.csv"),
  };
});

import OverduePage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
import { useLateFeeRateTiers } from "@/hooks/reactquery/lateFeeTiers";
import {
  useOverdueBuildings,
  useOverdueHouseholds,
  useOverduePeriods,
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
    phone2: "010-1111-3333",
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

type PeriodFixture = {
  occupancyId: number;
  unitId: number;
  period: string;
  unpaidPrincipal: number;
  dueDate: string;
};

type TierFixture = {
  id: number;
  orgId: number;
  tierOrder: number;
  fromMonth: number;
  toMonth: number | null;
  monthlyRate: number;
};

function setup({
  allowed = true,
  canMessage = true,
  periods = [],
  tiers = [],
  householdRows = households,
}: {
  allowed?: boolean;
  canMessage?: boolean;
  periods?: PeriodFixture[];
  tiers?: TierFixture[];
  householdRows?: readonly (typeof households)[number][];
} = {}) {
  vi.mocked(useMe).mockReturnValue({
    data: {
      orgId: 3,
      role: "staff",
      orgStatus: "active",
      username: "staff1",
      fullName: "담당자",
      isActive: true,
      mustChangePassword: false,
      staffType: "manager_staff",
      permissions: [
        ...(allowed ? ["overdue"] : []),
        ...(canMessage ? ["messaging"] : []),
      ],
    },
    isLoading: false,
  } as never);
  vi.mocked(useOverdueBuildings).mockReturnValue({ data: buildings, isLoading: false } as never);
  vi.mocked(useOverdueHouseholds).mockReturnValue({
    data: householdRows,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useOverduePeriods).mockReturnValue({
    data: periods,
    isLoading: false,
    error: null,
  } as never);
  vi.mocked(useLateFeeRateTiers).mockReturnValue({
    data: tiers,
    isLoading: false,
    error: null,
  } as never);
}

function selectPeriod(year = 2026, month = 7) {
  fireEvent.change(screen.getByRole("combobox", { name: "조회 년도" }), {
    target: { value: String(year) },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "조회 월" }), {
    target: { value: String(month) },
  });
}

function selectBuilding() {
  fireEvent.change(screen.getByRole("combobox", { name: "건물 선택" }), {
    target: { value: "그린빌라" },
  });
}

function showResults() {
  selectPeriod();
  selectBuilding();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_RESIDENT_WEB_ORIGIN", "https://resident.example.com/");
  mintBillTokens.mockImplementation(async ({ unitIds }: { unitIds: number[] }) =>
    unitIds.map((unitId) => ({ unitId, token: `overdue-token-${unitId}` })),
  );
  setup();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OverduePage", () => {
  it("기간 선택 전 Figma 빈 상태와 바로 사용할 수 있는 액션을 표시한다", () => {
    render(<OverduePage />);

    expect(screen.getByText("년도와 월을 선택해 주세요")).toBeInTheDocument();
    expect(screen.getByText("조회 기간을 고르면 미납 내역이 표시돼요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "미납대장 출력" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "독촉 문자 발송" })).toBeEnabled();
  });

  it("기간 선택 후에는 건물 선택 빈 상태로 전환한다", () => {
    render(<OverduePage />);
    selectPeriod();

    expect(screen.getByText("건물명을 검색해 선택해 주세요")).toBeInTheDocument();
  });

  it("overdue 권한이 없으면 화면 내용을 노출하지 않는다", () => {
    setup({ allowed: false });
    render(<OverduePage />);

    expect(screen.getByText("권한이 없습니다")).toBeInTheDocument();
    expect(screen.queryByLabelText("미납 조회 조건")).not.toBeInTheDocument();
  });

  it("messaging 권한이 없으면 독촉 문자 발송을 비활성화한다", () => {
    setup({ canMessage: false });
    render(<OverduePage />);
    showResults();

    expect(screen.getByRole("button", { name: "독촉 문자 발송" })).toBeDisabled();
    expect(messagingModalSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ open: true }),
    );
  });

  it("조회 결과를 12열 원장과 호합·고정 합계 구조로 표시한다", () => {
    render(<OverduePage />);
    showResults();

    for (const column of [
      "동호", "거래처명", "년월", "연체", "미납액", "납.연체료",
      "납.후연체", "연체료계", "합계", "비고", "전화", "이름",
    ]) {
      expect(screen.getByRole("columnheader", { name: column })).toBeInTheDocument();
    }
    expect(screen.getAllByText("[호합]")).toHaveLength(2);
    expect(screen.getByText("항목 2 / 2건")).toBeInTheDocument();
  });

  it("독촉 대상은 2개월 이상 AND 10만원 이상인 세대만 표시한다", () => {
    render(<OverduePage />);
    showResults();

    expect(screen.getByText("101호")).toBeInTheDocument();
    expect(screen.getByText("202호")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "채권 관리 필터" }));

    expect(screen.getByText("101호")).toBeInTheDocument();
    expect(screen.queryByText("202호")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "채권 관리 필터" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("조회 년월과 전체·당계 범위를 조회 훅에 전달한다", () => {
    render(<OverduePage />);
    showResults();

    expect(useOverdueHouseholds).toHaveBeenLastCalledWith(1, {
      year: 2026,
      month: 7,
      scope: "all",
    });
    fireEvent.click(screen.getByRole("button", { name: "당계" }));
    expect(useOverduePeriods).toHaveBeenLastCalledWith(1, {
      year: 2026,
      month: 7,
      scope: "current",
    });
  });

  it("월분 미납 원금과 요율표로 계산한 연체료를 표와 상세에 반영한다", () => {
    setup({
      periods: [{
        occupancyId: 31,
        unitId: 21,
        period: "2026-03-01",
        unpaidPrincipal: 100_000,
        dueDate: "2026-03-31",
      }],
      tiers: [
        { id: 1, orgId: 3, tierOrder: 1, fromMonth: 0, toMonth: 1, monthlyRate: 1 },
        { id: 2, orgId: 3, tierOrder: 2, fromMonth: 1, toMonth: 3, monthlyRate: 1.2 },
      ],
    });
    render(<OverduePage />);
    selectPeriod(2026, 6);
    selectBuilding();

    expect(screen.getAllByText("3,400").length).toBeGreaterThanOrEqual(3);
    fireEvent.click(screen.getByRole("row", { name: /101호 김입주 상세 보기/ }));
    expect(screen.getByText("연체료 내역")).toBeInTheDocument();
    expect(screen.getAllByText("3,400원")).toHaveLength(2);
  });

  it("독촉 기준에 맞는 세대를 자동 수신자로 담아 우측 작업창을 연다", async () => {
    setup({
      periods: [{
        occupancyId: 31,
        unitId: 21,
        period: "2026-05-01",
        unpaidPrincipal: 200_000,
        dueDate: "2026-05-31",
      }],
    });
    render(<OverduePage />);
    showResults();
    fireEvent.click(screen.getByRole("button", { name: "독촉 문자 발송" }));

    expect(await screen.findByRole("button", { name: "테스트 발송 완료" })).toBeInTheDocument();
    const openCall = [...messagingModalSpy.mock.calls]
      .reverse()
      .find(([props]) => props.open);
    expect(openCall?.[0]).toMatchObject({ presentation: "workspace", itemCount: 1 });
    expect(openCall?.[0].preset).toMatchObject({
      context: "독촉",
      buildingId: 1,
      channel: "sms",
      mode: "sms",
      templateTitle: "관리비 미납 안내",
      commonVariables: {
        건물명: "그린빌라",
        관리사무소연락처: "02-9876-5432",
      },
      recipients: [{
        name: "김입주",
        phone: "010-1111-2222",
        unitNo: "101호",
        variables: {
          세대: "101호",
          미납금액: "200,000",
          미납월: "2026년 5월",
          납기일: "2026-05-31",
          상세링크: "https://resident.example.com/r/overdue-token-21",
        },
      }, {
        name: "김입주",
        phone: "010-1111-3333",
        unitNo: "101호",
        variables: {
          세대: "101호",
          미납금액: "200,000",
          미납월: "2026년 5월",
          납기일: "2026-05-31",
          상세링크: "https://resident.example.com/r/overdue-token-21",
        },
      }],
    });
    expect(toast.success).toHaveBeenCalledWith("1세대를 수신자로 담았어요");
  });

  it("독촉 대상이 없으면 안내하고 발송 작업창을 열지 않는다", () => {
    setup({ householdRows: [households[1]] });
    render(<OverduePage />);
    showResults();
    fireEvent.click(screen.getByRole("button", { name: "독촉 문자 발송" }));

    expect(toast.info).toHaveBeenCalledWith("발송할 대상이 없어요");
    expect(messagingModalSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ open: true }),
    );
  });

  it("고지서 토큰 발급 실패 시 오류를 알리고 작업창을 열지 않는다", async () => {
    mintBillTokens.mockRejectedValueOnce(new Error("미납 토큰 발급 실패"));
    setup({
      periods: [{
        occupancyId: 31,
        unitId: 21,
        period: "2026-07-01",
        unpaidPrincipal: 200_000,
        dueDate: "2026-07-31",
      }],
    });
    render(<OverduePage />);
    showResults();
    fireEvent.click(screen.getByRole("button", { name: "독촉 문자 발송" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("미납 토큰 발급 실패"),
    );
    expect(messagingModalSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ open: true }),
    );
  });

  it("현재 필터 결과로 미납대장을 출력한다", () => {
    render(<OverduePage />);
    showResults();
    fireEvent.click(screen.getByRole("button", { name: "채권 관리 필터" }));
    fireEvent.click(screen.getByRole("button", { name: "미납대장 출력" }));

    expect(downloadOverdueLedger).toHaveBeenCalledWith("그린빌라", [
      expect.objectContaining({
        ...households[0],
        lateFeeAmount: 0,
        lateFeeByPeriod: [],
      }),
    ]);
    expect(toast.success).toHaveBeenCalledWith(
      "그린빌라_미납대장_202609.csv 파일을 저장했습니다.",
    );
  });

  it("원장 행을 선택하면 세대·입주자·미납 상세를 연다", () => {
    render(<OverduePage />);
    showResults();
    fireEvent.click(screen.getByRole("row", { name: /101호 김입주 상세 보기/ }));

    expect(screen.getByText("101호 상세")).toBeInTheDocument();
    expect(screen.getByText("세대 정보")).toBeInTheDocument();
    expect(screen.getByText("입주자 정보")).toBeInTheDocument();
    expect(screen.getByText("미납 정보")).toBeInTheDocument();
  });
});
