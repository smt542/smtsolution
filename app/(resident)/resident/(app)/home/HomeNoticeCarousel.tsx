"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

import type { ResidentNotice } from "@/hooks/reactquery/residentNotices";
import { formatDate } from "@/lib/format";

import { residentHomeClasses as styles } from "./homeClasses";

const AUTO_ADVANCE_MS = 5000;
/** 이만큼(px) 이상 끌면 다음·이전 장으로 넘기고, 덜 끌면 제자리로 돌아온다. */
const SWIPE_THRESHOLD_PX = 50;
/** 이만큼 이상 움직였으면 끌기로 보고, 놓았을 때 링크 이동(클릭)을 막는다. */
const DRAG_CLICK_GUARD_PX = 6;

/**
 * 홈 상단 공지 배너 캐러셀 — 최근 공지(최대 5개)를 5초마다 왼쪽으로 넘긴다.
 * 손가락·포인터가 올라가 있거나 키보드 포커스가 있으면 멈추고, 동작 줄이기 설정이면 자동으로 넘기지 않는다.
 * 하단 점: 기본 회색, 현재 장은 primary. 점을 누르면 그 장으로 이동한다.
 * 손가락·마우스로 옆으로 끌어 넘길 수 있다(끄는 동안 카드가 따라오고, 놓으면 넘기거나 제자리).
 */
export function HomeNoticeCarousel({
  notices,
  icon,
}: {
  notices: ResidentNotice[];
  icon: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = notices.length;
  const active = count > 0 ? index % count : 0;
  // 끌기: 시작 x·지금까지 이동량. 끄는 동안엔 transition 을 끄고 카드가 손가락을 따라오게 한다.
  const dragStartX = useRef<number | null>(null);
  const [dragDx, setDragDx] = useState(0);
  const dragged = useRef(false);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (count < 2 || (event.pointerType === "mouse" && event.button !== 0)) return;
    dragStartX.current = event.clientX;
    dragged.current = false;
    setDragDx(0);
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    const dx = event.clientX - dragStartX.current;
    if (!dragged.current && Math.abs(dx) > DRAG_CLICK_GUARD_PX) {
      dragged.current = true;
      // 끌기로 확정되면 포인터를 잡아 카드 밖으로 나가도 계속 따라오게 한다.
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (dragged.current) setDragDx(dx);
  };
  const endDrag = () => {
    if (dragStartX.current === null) return;
    dragStartX.current = null;
    if (dragDx <= -SWIPE_THRESHOLD_PX) setIndex((active + 1) % count);
    else if (dragDx >= SWIPE_THRESHOLD_PX) setIndex((active - 1 + count) % count);
    setDragDx(0);
  };

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [count, paused]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="최근 공지"
      className={styles.noticeCarousel}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className={styles.noticeViewport}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        // 끌고 놓은 뒤 따라오는 클릭은 링크 이동으로 처리하지 않는다.
        onClickCapture={(event) => {
          if (dragged.current) {
            event.preventDefault();
            event.stopPropagation();
            dragged.current = false;
          }
        }}
        onDragStart={(event) => event.preventDefault()}
      >
        <div
          className={`${styles.noticeTrack} ${dragDx !== 0 ? styles.noticeTrackDragging : ""}`}
          style={{ transform: `translateX(calc(-${active * 100}% + ${dragDx}px))` }}
        >
          {notices.map((notice, i) => (
            <Link
              key={notice.id}
              // 유입경로 표시: 공지 상세의 뒤로가기가 홈으로 돌아오게 한다.
              href={`/resident/notice/${notice.id}?from=home`}
              className={styles.noticeSlide}
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}: ${notice.title}`}
              aria-hidden={i !== active}
              tabIndex={i === active ? 0 : -1}
            >
              <span className={styles.noticeIcon}>{icon}</span>
              <span className={styles.noticeText}>
                <b className={styles.noticeTitle}>{notice.title}</b>
                <span className={styles.noticePreview}>
                  {notice.preview?.trim() || formatDate(notice.publishedAt)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
      {count > 1 ? (
        <div className={styles.noticeDots} role="tablist" aria-label="공지 넘기기">
          {notices.map((notice, i) => (
            <button
              key={notice.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`${i + 1}번째 공지 보기`}
              className={i === active ? styles.noticeDotOn : styles.noticeDotOff}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
