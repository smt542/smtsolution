"use client";

import { type RefObject, useEffect, useState } from "react";

interface FitPageSizeOptions {
  /** 잴 수 없을 때(thead·행 없음, onlyWhenAbsolute 조건 밖) 쓰는 행 수 */
  fallback: number;
  /** 최소 행 수(정본 3) */
  min?: number;
  /** true면 스크롤러가 absolute일 때만 잰다 — 일반 흐름이면 높이가 행 수를 따라가 계산이 줄어들기만 한다 */
  onlyWhenAbsolute?: boolean;
  /** 행 선택자(기본 표 `tbody tr`). 표가 아닌 목록은 headSelector null + rowSelector */
  rowSelector?: string;
  /** 머리 선택자(기본 `thead`). null이면 머리 없음(높이 0) */
  headSelector?: string | null;
  /** 바뀌면 다시 잰다(표가 새로 그려질 때 — 보통 목록 데이터) */
  watch?: unknown;
}

/**
 * 정본 fitPer(통합관리자 .hq-pg 표): 스크롤 영역 남는 높이에 들어가는 만큼 한 쪽 행 수.
 * 행 수 = max(min, floor((스크롤러 높이 − thead 높이) / 첫 행 높이)). 스크롤러 높이는 행 수와 무관해야 한다.
 * 스크롤러와 표를 함께 관찰해 창 크기·폰트 로드(행 높이 43→41px)가 바뀌면 다시 잰다.
 */
export function useFitPageSize(
  scrollerRef: RefObject<HTMLElement | null>,
  {
    fallback,
    min = 3,
    onlyWhenAbsolute = false,
    rowSelector = "tbody tr",
    headSelector = "thead",
    watch,
  }: FitPageSizeOptions,
): number {
  const [pageSize, setPageSize] = useState(fallback);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const measure = () => {
      const head = headSelector ? scroller.querySelector(headSelector) : null;
      const row = scroller.querySelector(rowSelector);
      if ((headSelector && !head) || !row) return;

      const next = onlyWhenAbsolute && window.getComputedStyle(scroller).position !== "absolute"
        ? fallback
        : Math.max(
          min,
          Math.floor(
            (scroller.clientHeight - (head ? head.getBoundingClientRect().height : 0))
              / (row.getBoundingClientRect().height || 41),
          ),
        );
      setPageSize((current) => (current === next ? current : next));
    };

    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    const observedContent = scroller.querySelector("table") ?? scroller.firstElementChild;
    if (observedContent) observer.observe(observedContent);
    const frame = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [scrollerRef, fallback, min, onlyWhenAbsolute, rowSelector, headSelector, watch]);

  return pageSize;
}
