import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getResidentNotices: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("./data", () => ({
  getResidentNotices: mocks.getResidentNotices,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import ResidentNoticeLoading from "./loading";
import ResidentNoticePage from "./page";

const renderPage = async () => render(<>{await ResidentNoticePage()}</>);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getResidentNotices.mockResolvedValue([]);
});

describe("ResidentNoticePage", () => {
  it("shows the route loading state and refreshes a failed server request", async () => {
    const loading = render(<ResidentNoticeLoading />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "공지사항을 불러오고 있어요.",
    );
    loading.unmount();

    mocks.getResidentNotices.mockRejectedValue(new Error("failed"));
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("shows the required empty state", async () => {
    await renderPage();

    expect(screen.getByText("등록된 내용이 없습니다")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute(
      "href",
      "/resident/home",
    );
  });

  it("renders dates, exact type labels, and detail links", async () => {
    mocks.getResidentNotices.mockResolvedValue([
      {
        id: 1,
        title: "일반 공지",
        noticeType: "normal",
        publishedAt: "2026-08-19T00:00:00Z",
      },
      {
        id: 2,
        title: "중요 공지",
        noticeType: "important",
        publishedAt: "2026-08-18T00:00:00Z",
      },
      {
        id: 3,
        title: "긴급 공지",
        noticeType: "urgent",
        publishedAt: "2026-08-17T00:00:00Z",
      },
    ]);
    await renderPage();

    expect(mocks.getResidentNotices).toHaveBeenCalledOnce();
    expect(screen.getByText("일반")).toBeInTheDocument();
    expect(screen.getByText("중요")).toBeInTheDocument();
    expect(screen.getByText("긴급")).toBeInTheDocument();
    expect(screen.getByText("2026.08.19")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /중요 공지/ })).toHaveAttribute(
      "href",
      "/resident/notice/2",
    );
  });
});
