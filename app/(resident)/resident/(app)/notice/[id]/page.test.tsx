import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getResidentNoticeDetailPageData: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../data", () => ({
  getResidentNoticeDetailPageData: mocks.getResidentNoticeDetailPageData,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import ResidentNoticeDetailLoading from "./loading";
import ResidentNoticeDetailPage from "./page";

const detail = {
  id: 12,
  title: "승강기 점검 안내",
  content: "오전 10시부터\n점검합니다.",
  noticeType: "important" as const,
  buildingId: 7,
  buildingName: "해오름빌라",
  publishedAt: "2026-08-19T00:00:00Z",
  createdAt: "2026-08-18T00:00:00Z",
};

const renderPage = async (id = "12") =>
  render(
    <>
      {await ResidentNoticeDetailPage({
        params: Promise.resolve({ id }),
      })}
    </>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getResidentNoticeDetailPageData.mockResolvedValue({
    detail,
    residentBuildingName: "해오름빌라",
  });
});

describe("ResidentNoticeDetailPage", () => {
  it("shows the route loading state and refreshes a failed server request", async () => {
    const loading = render(<ResidentNoticeDetailLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("공지를 불러오고 있어요.");
    loading.unmount();

    mocks.getResidentNoticeDetailPageData.mockRejectedValue(new Error("failed"));
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("parses the id and renders metadata and line-preserved body", async () => {
    await renderPage();

    expect(mocks.getResidentNoticeDetailPageData).toHaveBeenCalledWith(12);
    expect(
      screen.getByRole("heading", { name: "승강기 점검 안내" }),
    ).toBeInTheDocument();
    expect(screen.getByText("중요")).toBeInTheDocument();
    expect(screen.getByText("2026.08.19")).toBeInTheDocument();
    expect(screen.getByText(/오전 10시부터\s*점검합니다/)).toBeInTheDocument();
  });

  it("uses the linked building fallback for a building-wide notice", async () => {
    mocks.getResidentNoticeDetailPageData.mockResolvedValue({
      detail: { ...detail, buildingName: null },
      residentBuildingName: "해오름빌라",
    });

    await renderPage();

    expect(screen.getByText("해오름빌라")).toBeInTheDocument();
  });

  it("handles an invalid segment as not found without calling the RPC", async () => {
    await renderPage("not-a-number");

    expect(mocks.getResidentNoticeDetailPageData).not.toHaveBeenCalled();
    expect(screen.getByText("공지 내용을 찾을 수 없어요.")).toBeInTheDocument();
  });
});
