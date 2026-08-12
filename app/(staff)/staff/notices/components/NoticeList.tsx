"use client";

import type { Building } from "@/hooks/reactquery/buildings";
import type { Notice } from "@/hooks/reactquery/notices";
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
  onSelect,
}: {
  notices: Notice[];
  buildings: Building[];
  selectedId: number | null;
  onSelect: (notice: Notice) => void;
}) {
  const buildingNames = new Map(buildings.map((building) => [building.id, building.name]));

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-extrabold text-t1">공지 목록</h2>
        <p className="mt-1 text-xs text-t3">총 {notices.length}건</p>
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
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TYPE_CLASS[notice.noticeType]}`}>
                    {NOTICE_TYPE_LABELS[notice.noticeType]}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CLASS[status]}`}>
                    {NOTICE_STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-t3">
                    {notice.buildingId === null
                      ? "전체 공지"
                      : (buildingNames.get(notice.buildingId) ?? "삭제된 건물")}
                  </span>
                </div>
                <p className="mt-3 truncate font-bold text-t1">{notice.title}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-t3">{notice.content}</p>
                <p className="num mt-2 text-xs text-t4">
                  {status === "draft" ? `작성 ${formatNoticeDate(notice.createdAt)}` : `게시 ${formatNoticeDate(notice.publishedAt)}`}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
