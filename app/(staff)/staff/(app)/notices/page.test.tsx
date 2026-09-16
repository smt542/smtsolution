import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStaffContext: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../_staffContext", () => ({ getStaffContext: mocks.getStaffContext }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/occupancies", () => ({
  useTenantList: () => ({ data: [], isLoading: false, isError: false }),
  useOrganizationTenantList: () => ({ data: [], isLoading: false, isError: false }),
}));
vi.mock("@/hooks/reactquery/org/useOrgContact", () => ({
  useOrgContact: () => ({ data: { phone: "02-1234-5678" } }),
}));
vi.mock("@/hooks/reactquery/residentNotice", () => ({
  useMintNoticeShareToken: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/reactquery/notices", () => ({
  NOTICE_PAGE_SIZE: 20,
  useNotices: vi.fn(),
  useNotice: vi.fn(),
  useCreateNotice: vi.fn(),
  useUpdateNotice: vi.fn(),
  useDeleteNotice: vi.fn(),
  useNoticeImageUrls: () => ({ urls: {}, isLoading: false }),
  useNoticeSendSummary: () => ({ data: null, isLoading: false }),
  useAttachNoticeSendLog: () => ({ mutateAsync: vi.fn() }),
  prepareNoticeImages: vi.fn(async ({ doc }: { doc: unknown }) => ({
    nextDoc: doc,
    uploaded: [],
    failedCount: 0,
  })),
  finalizeNoticeImages: vi.fn(async () => ({ rowFailedCount: 0 })),
  removeNoticeImageObjects: vi.fn(async () => {}),
}));
vi.mock("../messaging/components/MessagingModal", () => ({
  MessagingModal: () => <div data-testid="messaging-modal" />,
}));
vi.mock("@/hooks/common/useAppToast", () => ({ appToast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/notices/NoticeEditor", () => ({
  NoticeEditor: ({ onChange }: { onChange: (doc: unknown) => void }) => (
    <textarea
      aria-label="내용"
      onChange={(event) =>
        onChange({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: event.target.value ? [{ type: "text", text: event.target.value }] : [],
            },
          ],
        })
      }
    />
  ),
}));
vi.mock("@/components/notices/NoticeContent", () => ({
  NoticeContent: ({ fallbackText }: { fallbackText?: string | null }) => <div>{fallbackText}</div>,
}));

import NoticesPage from "./page";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  useCreateNotice,
  useDeleteNotice,
  useNotice,
  useNotices,
  useUpdateNotice,
} from "@/hooks/reactquery/notices";

const me = {
  orgId: 9,
  role: "staff",
  permissions: ["notices"],
};
const buildings = [
  { id: 11, orgId: 9, code: "A", name: "해오름빌" },
  { id: 12, orgId: 9, code: "B", name: "푸른빌딩" },
];
const notices = [{
  id: 3,
  orgId: 9,
  buildingIds: [],
  title: "정기 소독 안내",
  content: "8월 20일 오전 10시에 소독합니다.",
  noticeType: "important",
  publishedAt: "2026-08-12T01:00:00.000Z",
  expiresAt: null,
  createdBy: null,
  createdAt: "2026-08-11T01:00:00.000Z",
  updatedAt: "2026-08-11T01:00:00.000Z",
}];

const createMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();

function setup(overrides?: { me?: unknown; notices?: typeof notices; noticesError?: boolean }) {
  const noticeRows = overrides?.notices ?? notices;
  mocks.getStaffContext.mockResolvedValue(overrides && "me" in overrides ? overrides.me : me);
  vi.mocked(useBuildings).mockReturnValue({ data: buildings, isLoading: false, isError: false, refetch: vi.fn() } as never);
  vi.mocked(useNotices).mockReturnValue({
    data: {
      items: noticeRows.map((notice) => ({
        id: notice.id,
        orgId: notice.orgId,
        buildingIds: notice.buildingIds,
        title: notice.title,
        noticeType: notice.noticeType,
        publishedAt: notice.publishedAt,
        expiresAt: notice.expiresAt,
        createdBy: notice.createdBy,
        createdAt: notice.createdAt,
        updatedAt: notice.updatedAt,
      })),
      total: noticeRows.length,
      page: 0,
      pageSize: 20,
    },
    isLoading: false,
    isError: overrides?.noticesError ?? false,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useNotice).mockImplementation((id: number) => ({
    data: noticeRows.find((notice) => notice.id === id),
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }) as never);
  vi.mocked(useCreateNotice).mockReturnValue({ mutateAsync: createMutate, isPending: false } as never);
  vi.mocked(useUpdateNotice).mockReturnValue({ mutateAsync: updateMutate, isPending: false } as never);
  vi.mocked(useDeleteNotice).mockReturnValue({ mutateAsync: deleteMutate, isPending: false } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  createMutate.mockResolvedValue(notices[0]);
  updateMutate.mockResolvedValue(notices[0]);
  deleteMutate.mockResolvedValue(undefined);
  setup();
});

describe("NoticesPage", () => {
  it("필터와 공지 목록을 렌더하고 선택한 공지의 상세를 표시", async () => {
    const user = userEvent.setup();
    render(await NoticesPage());

    expect(screen.getByRole("heading", { name: "공지 관리" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전체" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "긴급" })).toBeInTheDocument();
    expect(screen.getByText("공지 목록")).toBeInTheDocument();

    await user.click(screen.getByText("정기 소독 안내"));
    expect(screen.getByRole("heading", { name: "정기 소독 안내" })).toBeInTheDocument();
    expect(screen.getByText("대상 건물")).toBeInTheDocument();
  });

  it("notices 권한이 없으면 조회 UI를 노출하지 않음", async () => {
    setup({ me: { ...me, permissions: [] } });
    render(await NoticesPage());

    expect(screen.getByText("공지 관리 권한이 없습니다.")).toBeInTheDocument();
    expect(useBuildings).not.toHaveBeenCalled();
    expect(useNotices).not.toHaveBeenCalled();
  });

  it("공지 등록 모달은 전체와 건물 대상 칩을 제공", async () => {
    const user = userEvent.setup();
    render(await NoticesPage());
    await user.click(screen.getByRole("button", { name: /공지 등록/ }));

    const dialogTitle = screen.getByRole("heading", { name: "공지 등록" });
    const form = dialogTitle.parentElement!;
    expect(within(form).getByRole("checkbox", { name: "전체 건물" })).toBeInTheDocument();
    expect(within(form).getByRole("checkbox", { name: "해오름빌" })).toBeInTheDocument();
    expect(within(form).getByRole("checkbox", { name: "푸른빌딩" })).toBeInTheDocument();
    expect(screen.queryByText("입주자 선택")).not.toBeInTheDocument();
  });

  it("필수값을 입력하면 전체 공지를 즉시 등록", async () => {
    const user = userEvent.setup();
    render(await NoticesPage());
    await user.click(screen.getByRole("button", { name: /공지 등록/ }));
    await user.type(screen.getByLabelText(/제목/), "주차 안내");
    await user.type(screen.getByLabelText(/내용/), "주차장을 비워 주세요.");
    await user.click(screen.getByRole("button", { name: "등록" }));

    await waitFor(() => expect(createMutate).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 9,
      buildingIds: [],
      title: "주차 안내",
      content: "주차장을 비워 주세요.",
      noticeType: "normal",
      publishedAt: expect.any(String),
    })));
  });

  it("상세에서 삭제 확인 후 soft-delete mutation을 호출", async () => {
    render(await NoticesPage());
    fireEvent.click(screen.getByText("정기 소독 안내"));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    const modalTitle = screen.getByRole("heading", { name: "공지 삭제" });
    fireEvent.click(within(modalTitle.parentElement!).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith(3));
  });

  it("조회 실패 상태와 다시 시도를 표시", async () => {
    setup({ noticesError: true });
    render(await NoticesPage());
    expect(screen.getByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("서버 권한 조회 실패를 표시하고 새로고침으로 재시도", async () => {
    mocks.getStaffContext.mockRejectedValue(new Error("failed"));

    render(await NoticesPage());
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(screen.getByRole("alert")).toHaveTextContent("데이터를 불러오지 못했습니다.");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
