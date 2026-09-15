import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MessagingPreset } from "@/lib/messaging/preset";
import { buildRecipientRenderVariables } from "@/lib/messaging/preset";
import { renderTemplate } from "@/lib/messaging/render";

const messagingModalSpy = vi.fn();

vi.mock("@/hooks/reactquery/buildings", () => ({
  useBuildings: () => ({ data: [{ id: 3, name: "해오름빌" }] }),
}));
vi.mock("@/hooks/reactquery/asCategories", () => ({
  useAsCategories: () => ({ data: [] }),
}));
vi.mock("@/hooks/reactquery/units", () => ({
  useUnits: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/hooks/reactquery/occupancies", () => ({
  useOccupancies: () => ({ data: [] }),
}));
vi.mock("@/hooks/reactquery/accounts", () => ({
  useAccounts: () => ({
    data: [{
      userId: "field-1",
      fullName: "박기사",
      phone: "010-9999-0000",
      isActive: true,
    }],
  }),
}));
vi.mock("@/hooks/reactquery/complaints", () => ({
  useComplaints: () => ({
    data: [{
      id: 41,
      orgId: 7,
      buildingId: 3,
      unitId: 101,
      title: "수도 누수",
      content: "주방 싱크대 아래에서 물이 새요.",
      status: "completed",
      reporterName: "신고자",
      reporterPhone: "010-0000-0000",
      assignedTo: "field-1",
      receivedAt: "2026-08-24T01:00:00.000Z",
      createdAt: "2026-08-24T01:00:00.000Z",
      buildingName: "해오름빌",
      unitNo: "101호",
      unitDong: "A동",
      categoryLabel: "수도",
      resolutions: [],
    }],
    isLoading: false,
  }),
  useComplaintResolutions: () => ({ data: [], isLoading: false }),
  useCreateComplaint: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateComplaint: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateComplaintStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteComplaint: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateComplaintResolution: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateComplaintResolution: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteComplaintResolution: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/reactquery/org/useOrgContact", () => ({
  useOrgContact: () => ({ data: { phone: "02-1234-5678" } }),
}));
vi.mock("@/hooks/common/useAppToast", () => ({
  appToast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));
vi.mock("../../messaging/components/MessagingModal", () => ({
  MessagingModal: (props: { open: boolean; preset?: MessagingPreset }) => {
    messagingModalSpy(props);
    return props.open ? <p>테스트 메시지 모달</p> : null;
  },
}));

import { AsStatusSection } from "./AsStatusSection";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AsStatusSection resident messaging", () => {
  it("처리결과 필터를 원본형 커스텀 드롭다운으로 제공한다", () => {
    render(
      <AsStatusSection
        orgId={7}
        buildingId={3}
        unitId={101}
        canSendMessages
        resident={null}
      />,
    );

    const filter = screen.getByRole("button", { name: "처리결과 필터" });
    expect(filter).toHaveAttribute("aria-haspopup", "listbox");

    fireEvent.click(filter);
    fireEvent.click(screen.getByRole("option", { name: "미결" }));

    expect(screen.getByText("접수 내역이 없어요")).toBeInTheDocument();
  });

  it("건물 전체 범위에서는 원본처럼 호수 컬럼을 표시한다", () => {
    render(
      <AsStatusSection
        orgId={7}
        buildingId={3}
        unitId={101}
        canSendMessages
        resident={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "건물 전체" }));

    expect(screen.getByRole("columnheader", { name: "호수" })).toBeInTheDocument();
    expect(screen.getByText("101호")).toBeInTheDocument();
  });

  it("입주자용 민원·AS 처리 안내 preset을 정확한 템플릿과 완전한 변수로 구성한다", () => {
    render(
      <AsStatusSection
        orgId={7}
        buildingId={3}
        unitId={101}
        canSendMessages
        resident={{
          occupancyId: 91,
          name: "홍입주",
          phone: "010-1234-5678",
          alimtalkOptIn: true,
        }}
      />,
    );

    fireEvent.click(screen.getByText("수도 누수"));
    fireEvent.click(screen.getByRole("button", { name: "확인문자 보내기" }));

    expect(screen.getByText("테스트 메시지 모달")).toBeInTheDocument();
    const openCall = [...messagingModalSpy.mock.calls]
      .reverse()
      .find(([props]) => props.open);
    const preset = openCall?.[0].preset as MessagingPreset | undefined;
    expect(preset).toMatchObject({
      context: "민원·AS",
      buildingId: 3,
      channel: "alimtalk",
      mode: "auto",
      templateTitle: "민원·AS 처리 안내",
      commonVariables: {
        건물명: "해오름빌",
        관리사무소연락처: "02-1234-5678",
      },
      recipients: [{
        name: "홍입주",
        phone: "010-1234-5678",
        unitNo: "A동 101호",
        kind: "tenant",
        alimtalkOptIn: true,
        variables: {
          세대: "A동 101호",
          접수내용: "주방 싱크대 아래에서 물이 새요.",
          처리상태: "완결",
          담당자: "박기사",
        },
        ref: { occupancyId: 91, unitId: 101, buildingId: 3 },
      }],
    });

    const templates = [{
      id: 604,
      title: "민원·AS 처리 안내",
      body: "[#{건물명}] #{세대} #{접수내용} / #{처리상태} / #{담당자} / #{관리사무소연락처}",
    }];
    const template = templates.find(({ title }) => title === preset?.templateTitle);
    expect(template?.id).toBe(604);
    const renderedBodies = preset?.recipients?.map((recipient) =>
      renderTemplate(
        template?.body ?? "",
        buildRecipientRenderVariables(
          recipient,
          preset.commonVariables,
          "해오름빌",
        ),
      ),
    ) ?? [];
    expect(renderedBodies).toEqual([
      "[해오름빌] A동 101호 주방 싱크대 아래에서 물이 새요. / 완결 / 박기사 / 02-1234-5678",
    ]);
    expect(renderedBodies.every((body) => !body.includes("#{"))).toBe(true);
  });
});
