"use client";

import { useMemo } from "react";
import type { Building } from "@/hooks/reactquery/buildings";
import type { NoticeSummary, NoticeType } from "@/hooks/reactquery/notices";

const TYPE_BADGE: Record<NoticeType, { label: string; bg: string; text: string }> = {
  urgent:    { label: "긴급", bg: "bg-[#fff1f1]", text: "text-[#f04452]" },
  important: { label: "중요", bg: "bg-[#fff4e5]", text: "text-[#b26a00]" },
  normal:    { label: "신규", bg: "bg-[#f2f4f6]", text: "text-[#8b95a1]" },
};

const TYPE_TABS: Array<{ value: NoticeType | "all"; label: string }> = [
  { value: "all",       label: "전체" },
  { value: "normal",    label: "신규" },
  { value: "important", label: "중요" },
  { value: "urgent",    label: "긴급" },
];

function formatPublishDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export function NoticeList({
  notices,
  buildings,
  selectedId,
  total,
  page,
  pageSize,
  noticeType,
  onNoticeTypeChange,
  onSelect,
  onPageChange,
}: {
  notices: NoticeSummary[];
  buildings: Building[];
  selectedId: number | null;
  total: number;
  page: number;
  pageSize: number;
  noticeType: NoticeType | "all";
  onNoticeTypeChange: (type: NoticeType | "all") => void;
  onSelect: (notice: NoticeSummary) => void;
  onPageChange: (page: number) => void;
}) {
  const buildingNames = useMemo(
    () => new Map(buildings.map((b) => [b.id, b.name])),
    [buildings],
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="bg-white rounded-[16px] shadow-[0px_1px_3px_0px_rgba(23,31,40,0.05)] overflow-hidden">
      {/* 카드 헤더: 공지 목록 + 개수 배지 + 유형 탭 */}
      <div className="flex items-center gap-[8px] border-b border-[#f1f3f5] px-[18px] py-[15px]">
        <span className="font-extrabold text-[15px] text-[#191f28] whitespace-nowrap">공지 목록</span>
        <div className="bg-[#f2f4f6] px-[9px] py-[3px] rounded-[7px] shrink-0">
          <span className="font-bold text-[12px] text-[#8b95a1] leading-[16.8px]">{total}개</span>
        </div>
        <div className="flex-1" />
        {/* 유형 탭 (전체/신규/중요/긴급) */}
        <div className="flex gap-[2px] bg-[#edf0f3] p-[3px] rounded-[9px] shrink-0">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => onNoticeTypeChange(tab.value)}
              className={
                noticeType === tab.value
                  ? "bg-white shadow-[0px_1px_1.5px_rgba(23,31,40,0.1)] px-[11px] py-[5px] rounded-[7px] font-bold text-[12px] text-[#191f28]"
                  : "px-[11px] py-[5px] rounded-[7px] font-bold text-[12px] text-[#8b95a1]"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      {notices.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-[#8b95a1]">
          공지가 없습니다.
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[74px]" />
              <col />
              <col className="w-[180px]" />
              <col className="w-[110px]" />
              <col className="w-[150px]" />
              <col className="w-[90px]" />
            </colgroup>
            <thead>
              <tr className="bg-[#fbfcfd] border-b border-[#e8ebee]">
                {(["유형", "제목", "대상", "게시일", "알림톡", "작성자"] as string[]).map((h) => (
                  <th
                    key={h}
                    className="px-[16px] py-[11px] text-left font-bold text-[12px] text-[#8b95a1] whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notices.map((notice, idx) => {
                const badge = TYPE_BADGE[notice.noticeType];
                const isSelected = selectedId === notice.id;
                const isLast = idx === notices.length - 1;
                const buildingLabel =
                  notice.buildingId === null
                    ? "전체 건물"
                    : (buildingNames.get(notice.buildingId) ?? "삭제된 건물");

                return (
                  <tr
                    key={notice.id}
                    onClick={() => onSelect(notice)}
                    className={[
                      "cursor-pointer transition-colors",
                      !isLast ? "border-b border-[#f1f3f5]" : "",
                      isSelected ? "bg-[#f2f4f6]" : "hover:bg-[#fafbfc]",
                    ].join(" ")}
                  >
                    {/* 유형 배지 */}
                    <td className="px-[16px] py-[12px]">
                      <span
                        className={`inline-flex items-center px-[9px] py-[3px] rounded-[7px] font-extrabold text-[11.5px] whitespace-nowrap ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    {/* 제목 */}
                    <td className="px-[16px] py-[12px] font-bold text-[13.5px] text-[#191f28]">
                      <span className="block truncate">{notice.title}</span>
                    </td>
                    {/* 대상 */}
                    <td className="px-[16px] py-[12px] text-[13.5px] text-[#191f28] whitespace-nowrap">
                      {buildingLabel}
                    </td>
                    {/* 게시일 */}
                    <td className="px-[16px] py-[12px] text-[13.5px] text-[#191f28] whitespace-nowrap">
                      {formatPublishDate(notice.publishedAt)}
                    </td>
                    {/* 알림톡 */}
                    <td className="px-[16px] py-[12px] text-[13.5px] text-[#191f28] whitespace-nowrap">
                      -
                    </td>
                    {/* 작성자 */}
                    <td className="px-[16px] py-[12px] text-[13.5px] text-[#191f28] whitespace-nowrap">
                      {notice.createdBy ?? "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <nav
          aria-label="공지 목록 페이지"
          className="flex items-center justify-between border-t border-[#f1f3f5] px-[18px] py-[12px]"
        >
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            className="rounded-[7px] border border-[#e8ebee] px-[12px] py-[6px] text-[12px] font-bold text-[#4e5968] disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-[12px] text-[#8b95a1]">{page + 1} / {totalPages}</span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page + 1 >= totalPages}
            className="rounded-[7px] border border-[#e8ebee] px-[12px] py-[6px] text-[12px] font-bold text-[#4e5968] disabled:opacity-40"
          >
            다음
          </button>
        </nav>
      )}
    </div>
  );
}
