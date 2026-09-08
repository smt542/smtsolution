import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({ useResidentGuard: vi.fn() }));
const notices = vi.hoisted(() => ({ useResidentNotices: vi.fn() }));
vi.mock("@/lib/resident/useResidentGuard", () => guard);
vi.mock("@/hooks/reactquery/residentNotices", () => notices);

import ResidentNoticePage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  guard.useResidentGuard.mockReturnValue({
    loading: false,
    link: { buildingName: "해오름빌라", unitNo: "201호" },
    error: null,
    retry: vi.fn(),
  });
  notices.useResidentNotices.mockReturnValue({
    data: [],
    error: null,
    isPending: false,
    refetch: vi.fn(),
  });
});

describe("ResidentNoticePage", () => {
  it("shows the required empty state", () => {
    render(<ResidentNoticePage />);
    expect(screen.getByText("등록된 내용이 없습니다")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute("href", "/resident/home");
  });

  it("renders dates, exact type labels, and detail links", () => {
    notices.useResidentNotices.mockReturnValue({
      data: [
        { id: 1, title: "일반 공지", noticeType: "normal", publishedAt: "2026-08-19T00:00:00Z" },
        { id: 2, title: "중요 공지", noticeType: "important", publishedAt: "2026-08-18T00:00:00Z" },
        { id: 3, title: "긴급 공지", noticeType: "urgent", publishedAt: "2026-08-17T00:00:00Z" },
      ],
      error: null,
      isPending: false,
      refetch: vi.fn(),
    });
    render(<ResidentNoticePage />);

    expect(screen.getByText("일반")).toBeInTheDocument();
    expect(screen.getByText("중요")).toBeInTheDocument();
    expect(screen.getByText("긴급")).toBeInTheDocument();
    expect(screen.getByText("2026.08.19")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /중요 공지/ })).toHaveAttribute("href", "/resident/notice/2");
  });
});
