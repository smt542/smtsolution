import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MessagingPreset } from "@/lib/messaging/preset";
import {
  buildRecipientRenderVariables,
} from "@/lib/messaging/preset";
import { renderTemplate } from "@/lib/messaging/render";

const saveMutate = vi.fn();
const completeMutate = vi.fn();
const midMutate = vi.fn();
const messagingModalSpy = vi.fn();

vi.mock("@/hooks/reactquery/movingSettlement", () => ({
  useSaveSettlement: () => ({ mutate: saveMutate, isPending: false }),
  useCompleteSettlement: () => ({ mutate: completeMutate, isPending: false }),
  useMidMoveout: () => ({ mutate: midMutate, isPending: false }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));
vi.mock("@/hooks/reactquery/org/useOrgContact", () => ({
  useOrgContact: () => ({ data: { phone: "02-1234-5678" } }),
}));
vi.mock("../../messaging/components/MessagingModal", () => ({
  MessagingModal: (props: {
    open: boolean;
    preset?: MessagingPreset;
    onClose: () => void;
    onSent?: (result: { logId: number; count: number }) => void;
  }) => {
    messagingModalSpy(props);
    return props.open ? <p>테스트 정산내역서 발송</p> : null;
  },
}));

import { SettlementActions } from "./SettlementActions";

const draft = {
  moveOutDate: "2026-08-13",
  mgmtFeeMonthly: 300000,
  mgmtFeeProrated: 125806,
  waterCharge: 12000,
  elecCharge: 23000,
  gasCharge: 8000,
  elecPaidDate: "",
  gasPaidDate: "",
  repairAmount: 50000,
  repairAttribution: "owner" as const,
  repairMemo: "",
  settleBank: "",
  settleAcct: "",
  settleHolder: "",
  note: "",
  settlementNote: "",
};

const input = {
  unitId: 101,
  occupancyId: 9,
  settlementId: 31,
  data: {
    ...draft,
    elecPaidDate: null,
    gasPaidDate: null,
    repairMemo: null,
    settleBank: null,
    settleAcct: null,
    settleHolder: null,
    note: null,
    settlementNote: null,
  },
  checklist: [{ checkItemId: 7, checked: true }],
};

const settlementContext = {
  building: { id: 3, name: "해오름" },
  unit: {
    id: 101,
    unitNo: "101호",
    dong: "A동",
    buildingId: 3,
    buildingName: "해오름",
  },
  occupancy: {
    id: 9,
    tenantName: "홍길동",
    phone: "010-1234-5678",
    alimtalkOptIn: true,
    moveInDate: "2025-08-01",
    settlementNote: null,
    billingNote: null,
    status: "moving_out" as const,
  },
};

const renderActions = (amount = 218806) => render(
  <SettlementActions
    draft={draft}
    input={input}
    settlementId={31}
    amount={amount}
    onSaved={vi.fn()}
    {...settlementContext}
  />,
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("confirm", vi.fn(() => true));
});

describe("SettlementActions", () => {
  it("계산+저장 payload를 mutation에 전달한다", () => {
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "계산+저장" }));
    expect(saveMutate).toHaveBeenCalledWith(input, expect.any(Object));
  });

  it("중도퇴실 확인 뒤 RPC mutation을 호출한다", () => {
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "중도퇴실" }));
    expect(midMutate).toHaveBeenCalledWith(31, expect.any(Object));
  });

  it("미납 확인 모달 뒤 정산완료를 호출한다", () => {
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "정산완료+공실" }));
    expect(screen.getByText("미납 수납 확인")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "확인하고 완료" }));
    expect(completeMutate).toHaveBeenCalledWith(31, expect.any(Object));
  });

  it("퇴실자용 이사정산 내역서 preset을 정확한 템플릿과 완전한 변수로 구성한다", () => {
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "정산내역서 전송" }));

    expect(screen.getByText("테스트 정산내역서 발송")).toBeInTheDocument();
    const openCall = [...messagingModalSpy.mock.calls]
      .reverse()
      .find(([props]) => props.open);
    const preset = openCall?.[0].preset as MessagingPreset | undefined;
    expect(preset).toMatchObject({
      context: "이사정산",
      buildingId: 3,
      channel: "alimtalk",
      mode: "auto",
      templateTitle: "이사정산 내역서",
      commonVariables: {
        건물명: "해오름",
        관리사무소연락처: "02-1234-5678",
      },
      recipients: [{
        name: "홍길동",
        phone: "010-1234-5678",
        unitNo: "A동 101호",
        kind: "tenant",
        variables: {
          퇴실일: "2026-08-13",
          정산구분: "추가납부",
          정산금액: "218,806",
          세대: "A동 101호",
        },
        ref: { occupancyId: 9 },
      }],
    });

    const templates = [{
      id: 303,
      title: "이사정산 내역서",
      body: "[#{건물명}] #{세대} 퇴실일 #{퇴실일} #{정산구분} #{정산금액}원 문의 #{관리사무소연락처}",
    }];
    const template = templates.find(({ title }) => title === preset?.templateTitle);
    expect(template?.id).toBe(303);
    const renderedBodies = preset?.recipients?.map((recipient) =>
      renderTemplate(
        template?.body ?? "",
        buildRecipientRenderVariables(
          recipient,
          preset.commonVariables,
          settlementContext.building.name,
        ),
      ),
    ) ?? [];
    expect(renderedBodies).toHaveLength(1);
    expect(renderedBodies.every((body) => !body.includes("#{"))).toBe(true);
  });

  it("음수 정산금은 환급으로 파생한다", () => {
    renderActions(-50000);

    fireEvent.click(screen.getByRole("button", { name: "정산내역서 전송" }));

    const openCall = [...messagingModalSpy.mock.calls]
      .reverse()
      .find(([props]) => props.open);
    const preset = openCall?.[0].preset as MessagingPreset | undefined;
    expect(preset?.recipients?.[0].variables).toMatchObject({
      정산구분: "환급",
      정산금액: "-50,000",
    });
  });
});
