import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MessagingPreset } from "@/lib/messaging/preset";

const { lateFeeRateModalSpy, messagingModalSpy } = vi.hoisted(() => ({
  lateFeeRateModalSpy: vi.fn(),
  messagingModalSpy: vi.fn(),
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
vi.mock("./components/LateFeeRateModal", () => ({
  LateFeeRateModal: (props: {
    open: boolean;
    orgId: number;
    onClose: () => void;
  }) => {
    lateFeeRateModalSpy(props);
    return props.open ? <p>테스트 요율 모달</p> : null;
  },
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
import { useLateFeeRateTiers } from "@/hooks/reactquery/lateFeeTiers";
import {
  useOverdueBuildings,
  useOverdueHouseholds,
  useOverduePeriods,
} from "@/hooks/reactquery/overdue";
import { toast } from "sonner";
import { downloadOverdueLedger } from "./utils";
import { buildRecipientRenderVariables } from "@/lib/messaging/preset";
import { renderTemplate } from "@/lib/messaging/render";

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
  canEditLateFeeRate = false,
  periods = [],
  tiers = [],
}: {
  allowed?: boolean;
  canMessage?: boolean;
  canEditLateFeeRate?: boolean;
  periods?: Array<{
    occupancyId: number;
    unitId: number;
    period: string;
    unpaidPrincipal: number;
    dueDate: string;
  }>;
  tiers?: Array<{
    id: number;
    orgId: number;
    tierOrder: number;
    fromMonth: number;
    toMonth: number | null;
    monthlyRate: number;
  }>;
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
        ...(canEditLateFeeRate ? ["billing"] : []),
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
    setup({ canMessage: false, canEditLateFeeRate: false });
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

  it("billing 권한이 있을 때만 연체료 요율 설정 모달을 연다", () => {
    setup({ canEditLateFeeRate: false });
    const { unmount } = render(<OverduePage />);
    expect(screen.queryByRole("button", { name: "연체료 요율 설정" })).not.toBeInTheDocument();
    expect(lateFeeRateModalSpy).not.toHaveBeenCalled();
    unmount();

    setup({ canEditLateFeeRate: true });
    render(<OverduePage />);
    fireEvent.click(screen.getByRole("button", { name: "연체료 요율 설정" }));

    expect(screen.getByText("테스트 요율 모달")).toBeInTheDocument();
    expect(lateFeeRateModalSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ open: true, orgId: 3 }),
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
    expect(useOverduePeriods).toHaveBeenLastCalledWith(1, {
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
    expect(useOverduePeriods).toHaveBeenLastCalledWith(1, {
      year: 2026,
      month: 7,
      scope: "current",
    });
    expect(screen.getByText("연체 2개월 이상 AND 미납 10만원 이상")).toBeInTheDocument();
  });

  it("월분별 미납 원금과 요율표로 계산한 연체료를 표와 상세에 반영한다", () => {
    setup({
      periods: [
        {
          occupancyId: 31,
          unitId: 21,
          period: "2026-03-01",
          unpaidPrincipal: 100_000,
          dueDate: "2026-03-31",
        },
      ],
      tiers: [
        { id: 1, orgId: 3, tierOrder: 1, fromMonth: 0, toMonth: 1, monthlyRate: 1 },
        { id: 2, orgId: 3, tierOrder: 2, fromMonth: 1, toMonth: 3, monthlyRate: 1.2 },
      ],
    });
    render(<OverduePage />);
    selectBuilding();
    fireEvent.change(screen.getByLabelText("조회 기간"), {
      target: { value: "2026-06" },
    });

    expect(screen.getAllByText("3,400원")).toHaveLength(2);
    fireEvent.click(screen.getByText("101호"));
    expect(screen.getByText("연체료 내역")).toBeInTheDocument();
    expect(screen.getAllByText("3,400원")).toHaveLength(4);
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

  it("선택 세대별 최신 미납월 변수를 채우고 정확한 auto 알림톡 템플릿으로 완전히 렌더한다", () => {
    setup({
      allowed: true,
      canMessage: true,
      periods: [
        {
          occupancyId: 31,
          unitId: 21,
          period: "2026-05-01",
          unpaidPrincipal: 70_000,
          dueDate: "2026-05-31",
        },
        {
          occupancyId: 31,
          unitId: 21,
          period: "2026-08-01",
          unpaidPrincipal: 130_000,
          dueDate: "2026-08-31",
        },
        {
          occupancyId: 32,
          unitId: 22,
          period: "2026-06-01",
          unpaidPrincipal: 90_000,
          dueDate: "2026-06-30",
        },
      ],
      tiers: [{
        id: 1,
        orgId: 3,
        tierOrder: 1,
        fromMonth: 0,
        toMonth: null,
        monthlyRate: 10,
      }],
    });
    render(<OverduePage />);
    selectBuilding();
    fireEvent.click(screen.getByRole("checkbox", { name: "전체 세대 선택" }));
    fireEvent.click(screen.getByRole("button", { name: "독촉 문자 발송 (2)" }));

    expect(screen.getByRole("button", { name: "테스트 발송 완료" })).toBeInTheDocument();
    const openCall = [...messagingModalSpy.mock.calls]
      .reverse()
      .find(([props]) => props.open);
    const preset = openCall?.[0].preset as MessagingPreset | undefined;
    expect(preset).toMatchObject({
      context: "독촉",
      buildingId: 1,
      channel: "alimtalk",
      mode: "auto",
      templateTitle: "관리비 미납 안내",
      commonVariables: {
        건물명: "그린빌라",
        관리사무소연락처: "02-9876-5432",
      },
    });
    expect(preset?.body).toBeUndefined();
    expect(preset?.recipients).toEqual([
      {
        name: "김입주",
        phone: "010-1111-2222",
        unitNo: "101호",
        kind: "tenant",
        variables: {
          세대: "101호",
          미납금액: "200,000",
          미납월: "2026년 8월",
          납기일: "2026-08-31",
        },
        ref: { occupancyId: 31, buildingId: 1 },
      },
      {
        name: "이입주",
        phone: "010-3333-4444",
        unitNo: "202호",
        kind: "tenant",
        variables: {
          세대: "202호",
          미납금액: "90,000",
          미납월: "2026년 6월",
          납기일: "2026-06-30",
        },
        ref: { occupancyId: 32, buildingId: 1 },
      },
    ]);

    const templates = [{
      id: 302,
      title: "관리비 미납 안내",
      body: "[#{건물명}] 관리비 미납 안내\n#{세대} #{미납금액}원 #{미납월} #{납기일}\n문의: #{관리사무소연락처}",
    }];
    const template = templates.find(({ title }) => title === preset?.templateTitle);
    expect(template?.id).toBe(302);
    const renderedBodies = preset?.recipients?.map((recipient) =>
      renderTemplate(
        template?.body ?? "",
        buildRecipientRenderVariables(
          recipient,
          preset.commonVariables,
          "그린빌라",
        ),
      ),
    ) ?? [];
    expect(renderedBodies).toHaveLength(2);
    expect(renderedBodies.every((body) => !body.includes("#{"))).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "테스트 발송 완료" }));

    expect(toast.success).toHaveBeenCalledWith(
      "독촉 안내 1건 발송을 접수했습니다.",
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
    expect(downloadOverdueLedger).toHaveBeenCalledWith("그린빌라", [
      expect.objectContaining({
        ...households[0],
        lateFeeAmount: 0,
        lateFeeByPeriod: [],
      }),
    ]);
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
