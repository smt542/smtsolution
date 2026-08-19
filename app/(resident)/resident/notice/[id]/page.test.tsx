import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ params: { id: "12" } }));
const guard = vi.hoisted(() => ({ useResidentGuard: vi.fn() }));
const notices = vi.hoisted(() => ({ useResidentNoticeDetail: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => nav.params }));
vi.mock("@/lib/resident/useResidentGuard", () => guard);
vi.mock("@/hooks/reactquery/residentNotices", () => notices);

import ResidentNoticeDetailPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  nav.params.id = "12";
  guard.useResidentGuard.mockReturnValue({
    loading: false,
    link: { buildingName: "해오름빌라" },
    error: null,
    retry: vi.fn(),
  });
  notices.useResidentNoticeDetail.mockReturnValue({
    data: {
      id: 12,
      title: "승강기 점검 안내",
      content: "오전 10시부터\n점검합니다.",
      noticeType: "important",
      buildingName: "해오름빌라",
      publishedAt: "2026-08-19T00:00:00Z",
    },
    error: null,
    isPending: false,
    refetch: vi.fn(),
  });
});

describe("ResidentNoticeDetailPage", () => {
  it("parses the id and renders metadata and line-preserved body", () => {
    render(<ResidentNoticeDetailPage />);
    expect(notices.useResidentNoticeDetail).toHaveBeenCalledWith(12);
    expect(screen.getByRole("heading", { name: "승강기 점검 안내" })).toBeInTheDocument();
    expect(screen.getByText("중요")).toBeInTheDocument();
    expect(screen.getByText("2026.08.19")).toBeInTheDocument();
    expect(screen.getByText(/오전 10시부터\s*점검합니다/)).toBeInTheDocument();
  });

  it("handles an invalid segment as not found", () => {
    nav.params.id = "not-a-number";
    render(<ResidentNoticeDetailPage />);
    expect(notices.useResidentNoticeDetail).toHaveBeenCalledWith(0);
    expect(screen.getByText("공지 내용을 찾을 수 없어요.")).toBeInTheDocument();
  });
});
