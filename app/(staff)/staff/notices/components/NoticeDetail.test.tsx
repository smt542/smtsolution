import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Notice } from "@/hooks/reactquery/notices";
import type { MessagingPreset } from "@/lib/messaging/preset";
import { buildRecipientRenderVariables } from "@/lib/messaging/preset";
import { renderTemplate } from "@/lib/messaging/render";

const messagingModalSpy = vi.fn();
const useTenantListMock = vi.fn();
const useOrganizationTenantListMock = vi.fn();

vi.mock("@/hooks/reactquery/notices", () => ({
  useDeleteNotice: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/reactquery/occupancies", () => ({
  useTenantList: (...args: unknown[]) => useTenantListMock(...args),
  useOrganizationTenantList: (...args: unknown[]) => useOrganizationTenantListMock(...args),
}));
vi.mock("@/hooks/reactquery/org/useOrgContact", () => ({
  useOrgContact: () => ({ data: { phone: "02-1234-5678" } }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));
vi.mock("../../messaging/components/MessagingModal", () => ({
  MessagingModal: (props: { open: boolean; preset?: MessagingPreset }) => {
    messagingModalSpy(props);
    return props.open ? <p>테스트 공지 발송</p> : null;
  },
}));

import { NoticeDetail } from "./NoticeDetail";

const buildings = [
  { id: 11, name: "해오름빌" },
  { id: 12, name: "푸른빌딩" },
] as never;

const notice: Notice = {
  id: 3,
  orgId: 9,
  buildingId: 11,
  title: "정기 소독 안내",
  content: "8월 30일 오전 10시에 소독합니다.",
  noticeType: "important",
  publishedAt: "2026-08-24T01:00:00.000Z",
  expiresAt: null,
  createdBy: null,
  createdAt: "2026-08-23T01:00:00.000Z",
  updatedAt: "2026-08-23T01:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  useTenantListMock.mockReturnValue({
    data: [{
      unitId: 101,
      occupancyId: 91,
      unitNo: "101호",
      tenantName: "홍입주",
      phone: "010-1111-2222",
      isVacant: false,
    }],
    isLoading: false,
    isError: false,
  });
  useOrganizationTenantListMock.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  });
});

describe("NoticeDetail messaging", () => {
  it("건물 공지의 입주자 안내 preset을 정확한 중요 템플릿과 완전한 변수로 구성한다", () => {
    render(
      <NoticeDetail
        notice={notice}
        buildings={buildings}
        canSendMessages
        onEdit={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "공지 알림 발송" }));

    expect(useTenantListMock).toHaveBeenCalledWith(11);
    expect(screen.getByText("테스트 공지 발송")).toBeInTheDocument();
    const openCall = [...messagingModalSpy.mock.calls]
      .reverse()
      .find(([props]) => props.open);
    const preset = openCall?.[0].preset as MessagingPreset | undefined;
    expect(preset).toMatchObject({
      context: "공지",
      buildingId: 11,
      channel: "alimtalk",
      mode: "auto",
      templateTitle: "공지 안내(중요)",
      commonVariables: {
        건물명: "해오름빌",
        관리사무소연락처: "02-1234-5678",
      },
      recipients: [{
        name: "홍입주",
        phone: "010-1111-2222",
        unitNo: "101호",
        kind: "tenant",
        variables: { 공지제목: "정기 소독 안내" },
        ref: { occupancyId: 91, unitId: 101, buildingId: 11 },
      }],
    });

    const templates = [{
      id: 702,
      title: "공지 안내(중요)",
      body: "[#{건물명}] 중요 공지: #{공지제목} / #{관리사무소연락처}",
    }];
    const template = templates.find(({ title }) => title === preset?.templateTitle);
    expect(template?.id).toBe(702);
    const renderedBodies = preset?.recipients?.map((recipient) =>
      renderTemplate(
        template?.body ?? "",
        buildRecipientRenderVariables(recipient, preset.commonVariables, "해오름빌"),
      ),
    ) ?? [];
    expect(renderedBodies).toEqual([
      "[해오름빌] 중요 공지: 정기 소독 안내 / 02-1234-5678",
    ]);
    expect(renderedBodies.every((body) => !body.includes("#{"))).toBe(true);
  });

  it("전체 공지는 기존 건물별 세대 조회 결과를 합쳐 수신자를 구성한다", () => {
    useOrganizationTenantListMock.mockReturnValue({
      data: [
        {
          buildingId: 11,
          unitId: 101,
          occupancyId: 91,
          unitNo: "101호",
          tenantName: "홍입주",
          phone: "010-1111-2222",
          isVacant: false,
        },
        {
          buildingId: 12,
          unitId: 202,
          occupancyId: 92,
          unitNo: "202호",
          tenantName: "김입주",
          phone: "010-3333-4444",
          isVacant: false,
        },
      ],
      isLoading: false,
      isError: false,
    });

    render(
      <NoticeDetail
        notice={{ ...notice, buildingId: null, noticeType: "normal" }}
        buildings={buildings}
        canSendMessages
        onEdit={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "공지 알림 발송" }));

    expect(useOrganizationTenantListMock).toHaveBeenCalledWith([11, 12]);
    const openCall = [...messagingModalSpy.mock.calls]
      .reverse()
      .find(([props]) => props.open);
    const preset = openCall?.[0].preset as MessagingPreset | undefined;
    expect(preset?.templateTitle).toBe("공지 안내(신규)");
    expect(preset?.recipients).toHaveLength(2);
    expect(preset?.recipients?.map((recipient) => recipient.variables)).toEqual([
      { 공지제목: "정기 소독 안내", 건물명: "해오름빌" },
      { 공지제목: "정기 소독 안내", 건물명: "푸른빌딩" },
    ]);
  });

  it("예약 게시 공지는 같은 시각을 예약 발송 preset으로 전달한다", () => {
    render(
      <NoticeDetail
        notice={{
          ...notice,
          noticeType: "urgent",
          publishedAt: "2099-08-30T01:30:00.000Z",
        }}
        buildings={buildings}
        canSendMessages
        onEdit={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "공지 알림 발송" }));

    const openCall = [...messagingModalSpy.mock.calls]
      .reverse()
      .find(([props]) => props.open);
    expect(openCall?.[0].preset).toMatchObject({
      templateTitle: "공지 안내(긴급)",
      scheduledAt: "2099-08-30T01:30:00.000Z",
    });
  });
});
