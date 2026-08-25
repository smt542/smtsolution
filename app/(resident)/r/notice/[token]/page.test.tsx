import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({
  params: { token: "11111111-2222-4333-8444-555555555555" },
}));
const notice = vi.hoisted(() => ({ usePublicNoticeByToken: vi.fn() }));

vi.mock("next/navigation", () => ({ useParams: () => nav.params }));
vi.mock("@/hooks/reactquery/residentNotice", () => notice);

import PublicNoticePage from "./page";

const publicNotice = {
  title: "수도 점검 안내",
  content: "오전 10시부터 수도 점검을 진행합니다.",
  noticeType: "important",
  buildingName: "그린빌라",
  publishedAt: "2026-08-25T01:00:00Z",
  isExpired: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  notice.usePublicNoticeByToken.mockReturnValue({
    data: publicNotice,
    error: null,
    isPending: false,
    refetch: vi.fn(),
  });
});

describe("PublicNoticePage", () => {
  it("shows pending and retryable error states", () => {
    const refetch = vi.fn();
    notice.usePublicNoticeByToken
      .mockReturnValueOnce({
        data: undefined,
        error: null,
        isPending: true,
        refetch,
      })
      .mockReturnValueOnce({
        data: undefined,
        error: new Error("failed"),
        isPending: false,
        refetch,
      });

    const view = render(<PublicNoticePage />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "공지사항을 불러오고 있어요.",
    );

    view.rerender(<PublicNoticePage />);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows invalid and expired links without masked content", () => {
    notice.usePublicNoticeByToken
      .mockReturnValueOnce({
        data: null,
        error: null,
        isPending: false,
        refetch: vi.fn(),
      })
      .mockReturnValueOnce({
        data: {
          title: null,
          content: null,
          noticeType: null,
          buildingName: null,
          publishedAt: null,
          isExpired: true,
        },
        error: null,
        isPending: false,
        refetch: vi.fn(),
      });

    const view = render(<PublicNoticePage />);
    expect(screen.getByText("유효하지 않은 링크예요.")).toBeInTheDocument();

    view.rerender(<PublicNoticePage />);
    expect(screen.getByText("만료된 링크예요.")).toBeInTheDocument();
    expect(screen.queryByText(publicNotice.title)).not.toBeInTheDocument();
  });

  it("renders the whitelisted notice detail", () => {
    render(<PublicNoticePage />);

    expect(notice.usePublicNoticeByToken).toHaveBeenCalledWith(
      "11111111-2222-4333-8444-555555555555",
    );
    expect(screen.getByRole("heading", { name: publicNotice.title })).toBeInTheDocument();
    expect(screen.getByText(publicNotice.content)).toBeInTheDocument();
    expect(screen.getByText("그린빌라 · 2026.08.25")).toBeInTheDocument();
    expect(screen.queryByText(/010-/)).not.toBeInTheDocument();
  });
});
