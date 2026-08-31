"use client";

import { useMemo } from "react";
import { Badge } from "@/components/common";
import type { Building } from "@/hooks/reactquery/buildings";
import type { NoticeSummary } from "@/hooks/reactquery/notices";
import {
  formatNoticeDate,
  getNoticeStatus,
  NOTICE_STATUS_LABELS,
  NOTICE_TYPE_LABELS,
} from "../utils";

const TYPE_CLASS = {
  normal: "bg-bg text-t2",
  important: "bg-amber-t text-amber",
  urgent: "bg-red-t text-red",
};

const STATUS_CLASS = {
  draft: "bg-bg text-t3",
  scheduled: "bg-blue-t text-blue-d",
  published: "bg-green-t text-green",
  expired: "bg-bg text-t3",
};

export function NoticeList({
  notices,
  buildings,
  selectedId,
  total,
  page,
  pageSize,
  onSelect,
  onPageChange,
}: {
  notices: NoticeSummary[];
  buildings: Building[];
  selectedId: number | null;
  total: number;
  page: number;
  pageSize: number;
  onSelect: (notice: NoticeSummary) => void;
  onPageChange: (page: number) => void;
}) {
  const buildingNames = useMemo(
    () => new Map(buildings.map((building) => [building.id, building.name])),
    [buildings],
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-extrabold text-t1">공지 목록</h2>
        <p className="mt-1 text-xs text-t3">총 {total}건</p>
      </div>
      <ul className="divide-y divide-line">
        {notices.map((notice) => {
          const status = getNoticeStatus(notice);
          const isSelected = selectedId === notice.id;
          return (
            <li key={notice.id}>
              <button
                type="button"
                aria-label={`${notice.title} 상세 보기`}
                aria-pressed={isSelected}
                onClick={() => onSelect(notice)}
                className={`w-full px-5 py-4 text-left transition-colors hover:bg-blue-t2 ${
                  isSelected ? "bg-blue-t2" : "bg-surface"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`px-2.5 py-1 ${TYPE_CLASS[notice.noticeType]}`}>
                    {NOTICE_TYPE_LABELS[notice.noticeType]}
                  </Badge>
                  <Badge className={`px-2.5 py-1 ${STATUS_CLASS[status]}`}>
                    {NOTICE_STATUS_LABELS[status]}
                  </Badge>
                  <span className="text-xs text-t3">
                    {notice.buildingId === null
                      ? "전체 공지"
                      : (buildingNames.get(notice.buildingId) ?? "삭제된 건물")}
                  </span>
                </div>
                <p className="mt-3 truncate font-bold text-t1">{notice.title}</p>
                <p className="num mt-2 text-xs text-t4">
                  {status === "draft" ? `작성 ${formatNoticeDate(notice.createdAt)}` : `게시 ${formatNoticeDate(notice.publishedAt)}`}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
      {totalPages > 1 && (
        <nav
          aria-label="공지 목록 페이지"
          className="flex items-center justify-between border-t border-line px-5 py-3"
        >
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-t2 disabled:opacity-40"
          >
            이전
          </button>
          <span className="num text-xs text-t3">{page + 1} / {totalPages}</span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page + 1 >= totalPages}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-t2 disabled:opacity-40"
          >
            다음
          </button>
        </nav>
      )}
    </div>
  );
}
