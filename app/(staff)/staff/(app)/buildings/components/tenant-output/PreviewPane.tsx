"use client";
import type { CSSProperties, ReactNode } from "react";
import { Spinner } from "@/components/common";
import { PrinterIcon } from "@/components/icons";

/** 미리보기 시트(190mm)를 좌우 패널 폭에 맞춰 축소하는 배율. */
export const PREVIEW_SCALE = 0.44;
const scaleStyle = { zoom: PREVIEW_SCALE } as CSSProperties;

interface PreviewPaneProps {
  title: string;
  count: number;
  page: number; // 1-based
  onPrev: () => void;
  onNext: () => void;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  emptyHint?: string;
  children?: ReactNode; // 현재 페이지 문서 시트
}

/** 미리보기 패널 공통 크롬: 제목·장수 배지 · 페이저 · 개별 인쇄 버튼 · 축소 문서 영역. */
export function PreviewPane({
  title,
  count,
  page,
  onPrev,
  onNext,
  actionLabel,
  onAction,
  actionDisabled,
  loading = false,
  emptyMessage,
  emptyHint,
  children,
}: PreviewPaneProps) {
  const hasContent = count > 0;
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="flex items-center justify-between px-[14px] pt-[12px]">
        <h3 className="text-[13px] font-extrabold text-t1">{title}</h3>
        <span className="rounded-full bg-bg px-[8px] py-[2px] text-[11px] font-bold text-t3">총 {count}장</span>
      </div>
      <div className="flex items-center justify-between px-[14px] pb-[10px] pt-[8px]">
        <div className="flex items-center gap-[6px]">
          <button
            type="button"
            aria-label="이전 페이지"
            onClick={onPrev}
            disabled={!hasContent || page <= 1}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] border border-line bg-white text-t2 disabled:opacity-40"
          >
            ‹
          </button>
          <span className="text-[11.5px] font-bold text-t2">
            {hasContent ? page : 0} / {count}
          </span>
          <button
            type="button"
            aria-label="다음 페이지"
            onClick={onNext}
            disabled={!hasContent || page >= count}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] border border-line bg-white text-t2 disabled:opacity-40"
          >
            ›
          </button>
        </div>
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          className="inline-flex h-[26px] items-center gap-[5px] rounded-[8px] border border-line bg-white px-[10px] text-[11.5px] font-bold text-t2 hover:bg-bg disabled:opacity-40"
        >
          <PrinterIcon className="h-[13px] w-[13px]" />
          {actionLabel}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#e9ecef] p-[12px]">
        {loading ? (
          <Spinner label={`${title} 불러오는 중`} showLabel />
        ) : hasContent ? (
          <div style={scaleStyle}>{children}</div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-[4px] px-4 text-center">
            <p className="text-[12.5px] font-bold text-t2">{emptyMessage ?? "표시할 내용이 없습니다"}</p>
            {emptyHint && <p className="text-[11.5px] text-t3">{emptyHint}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
