"use client";

import { Button, SearchBar, Select } from "@/components/common";
import type { Building } from "@/hooks/reactquery/buildings";

interface Props {
  buildings: Building[];
  target: string;
  noticeType: string;
  status: string;
  search: string;
  onTargetChange: (value: string) => void;
  onNoticeTypeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onReset: () => void;
}

export function NoticeFilters({
  buildings,
  target,
  noticeType,
  status,
  search,
  onTargetChange,
  onNoticeTypeChange,
  onStatusChange,
  onSearchChange,
  onReset,
}: Props) {
  const targetOptions = [
    { value: "all", label: "모든 대상" },
    { value: "organization", label: "전체 공지" },
    ...buildings.map((building) => ({ value: String(building.id), label: building.name })),
  ];

  return (
    <section aria-label="공지 필터" className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_160px_160px_minmax(220px,1.4fr)_auto]">
        <div>
          <label htmlFor="notice-target-filter" className="mb-1 block text-xs font-semibold text-t2">
            공지 대상
          </label>
          <Select
            id="notice-target-filter"
            value={target}
            onChange={(event) => onTargetChange(event.target.value)}
            options={targetOptions}
          />
        </div>
        <div>
          <label htmlFor="notice-type-filter" className="mb-1 block text-xs font-semibold text-t2">
            공지 유형
          </label>
          <Select
            id="notice-type-filter"
            value={noticeType}
            onChange={(event) => onNoticeTypeChange(event.target.value)}
            options={[
              { value: "all", label: "전체 유형" },
              { value: "normal", label: "일반" },
              { value: "important", label: "중요" },
              { value: "urgent", label: "긴급" },
            ]}
          />
        </div>
        <div>
          <label htmlFor="notice-status-filter" className="mb-1 block text-xs font-semibold text-t2">
            게시 상태
          </label>
          <Select
            id="notice-status-filter"
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            options={[
              { value: "all", label: "전체 상태" },
              { value: "published", label: "게시 중" },
              { value: "scheduled", label: "예약" },
              { value: "draft", label: "초안" },
              { value: "expired", label: "종료" },
            ]}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">검색</label>
          <SearchBar value={search} onChange={onSearchChange} placeholder="제목 또는 내용 검색" />
        </div>
        <Button type="button" variant="ghost" className="self-end" onClick={onReset}>
          초기화
        </Button>
      </div>
    </section>
  );
}
