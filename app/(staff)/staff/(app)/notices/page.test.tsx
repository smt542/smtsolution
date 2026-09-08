import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
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
}));
vi.mock("../messaging/components/MessagingModal", () => ({
  MessagingModal: () => <div data-testid="messaging-modal" />,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import NoticesPage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
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
  buildingId: null,
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
  vi.mocked(useMe).mockReturnValue({
    data: overrides && "me" in overrides ? overrides.me : me,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useBuildings).mockReturnValue({ data: buildings, isLoading: false, isError: false, refetch: vi.fn() } as never);
  vi.mocked(useNotices).mockReturnValue({
    data: {
      items: noticeRows.map((notice) => ({
        id: notice.id,
        orgId: notice.orgId,
        buildingId: notice.buildingId,
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
    render(<NoticesPage />);

    expect(screen.getByRole("heading", { name: "공지 관리" })).toBeInTheDocument();
    expect(screen.getByLabelText("공지 대상")).toHaveTextContent("해오름빌");
    expect(screen.getByLabelText("공지 유형")).toBeInTheDocument();
    expect(screen.getByLabelText("게시 상태")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "정기 소독 안내 상세 보기" }));
    expect(screen.getByRole("heading", { name: "정기 소독 안내" })).toBeInTheDocument();
    expect(screen.getByText("게시 일시")).toBeInTheDocument();
  });

  it("notices 권한이 없으면 조회 UI를 노출하지 않음", () => {
    setup({ me: { ...me, permissions: [] } });
    render(<NoticesPage />);

    expect(screen.getByText("공지 관리 권한이 없습니다.")).toBeInTheDocument();
    expect(useBuildings).not.toHaveBeenCalled();
    expect(useNotices).not.toHaveBeenCalled();
  });

  it("공지 등록 모달은 전체와 건물 대상만 제공", async () => {
    const user = userEvent.setup();
    render(<NoticesPage />);
    await user.click(screen.getByRole("button", { name: /공지 등록/ }));

    const dialogTitle = screen.getByRole("heading", { name: "공지 등록" });
    const form = dialogTitle.parentElement!;
    const target = within(form).getByLabelText(/공지 대상/);
    expect(target).toHaveTextContent("전체 공지");
    expect(target).toHaveTextContent("해오름빌");
    expect(target).not.toHaveTextContent("호실");
    expect(screen.queryByText("입주자 선택")).not.toBeInTheDocument();
  });

  it("필수값을 입력하면 전체 공지를 즉시 등록", async () => {
    const user = userEvent.setup();
    render(<NoticesPage />);
    await user.click(screen.getByRole("button", { name: /공지 등록/ }));
    await user.type(screen.getByLabelText(/제목/), "주차 안내");
    await user.type(screen.getByLabelText(/내용/), "주차장을 비워 주세요.");
    await user.click(screen.getByRole("button", { name: "등록" }));

    await waitFor(() => expect(createMutate).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 9,
      buildingId: null,
      title: "주차 안내",
      content: "주차장을 비워 주세요.",
      noticeType: "normal",
      publishedAt: expect.any(String),
    })));
  });

  it("상세에서 삭제 확인 후 soft-delete mutation을 호출", async () => {
    render(<NoticesPage />);
    fireEvent.click(screen.getByRole("button", { name: "정기 소독 안내 상세 보기" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    const modalTitle = screen.getByRole("heading", { name: "공지 삭제" });
    fireEvent.click(within(modalTitle.parentElement!).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith(3));
  });

  it("조회 실패와 빈 목록 상태를 각각 표시", () => {
    setup({ noticesError: true });
    const { rerender } = render(<NoticesPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("데이터를 불러오지 못했습니다.");

    setup({ notices: [] });
    rerender(<NoticesPage />);
    expect(screen.getByText("조건에 맞는 공지가 없습니다.")).toBeInTheDocument();
  });
});
