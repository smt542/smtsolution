"use client";

import type { ReactNode } from "react";
import { Spinner } from "@/components/common";

interface MessagingListCardProps {
  /** 카드 제목(예: "예약 발송"). */
  title: string;
  /** 제목 옆 건수. */
  count: number;
  /** 헤더 우측 슬롯(필터·액션 버튼). */
  actions?: ReactNode;
  /** 백그라운드 재조회 중 여부. 헤더에 인라인 스피너를 노출한다. */
  refreshing?: boolean;
  refreshingLabel: string;
  /** 최초 로딩 여부. */
  isLoading?: boolean;
  loadingLabel: string;
  /** 조회 오류. */
  error?: unknown;
  errorMessage: string;
  onRetry?: () => void;
  /** 데이터가 비었는지 여부. */
  isEmpty?: boolean;
  emptyMessage: string;
  /** 정상 상태에서 렌더할 본문(표). */
  children?: ReactNode;
}

/**
 * 메시징 탭 공용 리스트 카드. 예약 발송·발송 내역·템플릿 관리 탭이
 * 동일한 카드 셸/헤더/로딩·오류·빈 상태 크롬을 공유한다(프로토타입 `.hf-panel`).
 */
export function MessagingListCard({
  title,
  count,
  actions,
  refreshing = false,
  refreshingLabel,
  isLoading = false,
  loadingLabel,
  error,
  errorMessage,
  onRetry,
  isEmpty = false,
  emptyMessage,
  children,
}: MessagingListCardProps) {
  return (
    <div className="min-h-[240px] overflow-hidden rounded-[16px] bg-white shadow-[0px_1px_3px_0px_rgba(23,31,40,0.05)]">
      {/* 카드 헤더 */}
      <div className="flex items-center gap-[8px] border-b border-[#f1f3f5] px-[18px] py-[15px]">
        <span className="text-[15px] font-extrabold leading-normal text-[#191f28]">
          {title}
        </span>
        <span className="text-[13px] font-semibold leading-normal text-[#8b95a1]">
          {count}
        </span>
        <div className="flex-1" />
        {refreshing ? (
          <Spinner label={refreshingLabel} size="small" showLabel className="px-2 py-1" />
        ) : null}
        {actions}
      </div>

      {/* 본문 */}
      {isLoading ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 py-10">
          <Spinner label={loadingLabel} showLabel />
        </div>
      ) : error ? (
        <div role="alert" className="py-10 text-center">
          <p className="text-[14px] font-bold text-[#191f28]">{errorMessage}</p>
          {onRetry ? (
            <button
              type="button"
              className="mt-4 text-[13px] text-[#14a497]"
              onClick={onRetry}
            >
              다시 시도
            </button>
          ) : null}
        </div>
      ) : isEmpty ? (
        <p className="py-[34px] text-center text-[13.5px] font-semibold text-[#8b95a1]">
          {emptyMessage}
        </p>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </div>
  );
}
