import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublicNoticeByToken: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("./data", () => ({
  getPublicNoticeByToken: mocks.getPublicNoticeByToken,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import PublicNoticeLoading from "./loading";
import PublicNoticePage from "./page";

const token = "11111111-2222-4333-8444-555555555555";
const publicNotice = {
  title: "수도 점검 안내",
  content: "오전 10시부터 수도 점검을 진행합니다.",
  noticeType: "important" as const,
  buildingName: "그린빌라",
  publishedAt: "2026-08-25T01:00:00Z",
  isExpired: false,
};

const renderPage = async () =>
  render(<>{await PublicNoticePage({ params: Promise.resolve({ token }) })}</>);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublicNoticeByToken.mockResolvedValue(publicNotice);
});

describe("PublicNoticePage", () => {
  it("shows the route loading state and refreshes a failed server request", async () => {
    const loading = render(<PublicNoticeLoading />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "공지사항을 불러오고 있어요.",
    );
    loading.unmount();

    mocks.getPublicNoticeByToken.mockRejectedValue(new Error("failed"));
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("shows invalid and expired links without masked content", async () => {
    mocks.getPublicNoticeByToken
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        title: null,
        content: null,
        noticeType: null,
        buildingName: null,
        publishedAt: null,
        isExpired: true,
      });

    const view = await renderPage();
    expect(screen.getByText("유효하지 않은 링크예요.")).toBeInTheDocument();

    view.rerender(
      <>
        {await PublicNoticePage({ params: Promise.resolve({ token }) })}
      </>,
    );
    expect(screen.getByText("만료된 링크예요.")).toBeInTheDocument();
    expect(screen.queryByText(publicNotice.title)).not.toBeInTheDocument();
  });

  it("renders the server-fetched whitelisted notice detail", async () => {
    await renderPage();

    expect(mocks.getPublicNoticeByToken).toHaveBeenCalledWith(token);
    expect(screen.getByRole("heading", { name: publicNotice.title })).toBeInTheDocument();
    expect(screen.getByText(publicNotice.content)).toBeInTheDocument();
    expect(screen.getByText("그린빌라 · 2026.08.25")).toBeInTheDocument();
    expect(screen.queryByText(/010-/)).not.toBeInTheDocument();
  });
});
