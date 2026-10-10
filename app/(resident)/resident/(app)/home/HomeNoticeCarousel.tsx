"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import type { ResidentNotice } from "@/hooks/reactquery/residentNotices";
import { formatDate } from "@/lib/format";

import { residentHomeClasses as styles } from "./homeClasses";

const AUTO_ADVANCE_MS = 5000;

/**
 * 홈 상단 공지 배너 캐러셀 — 최근 공지(최대 5개)를 5초마다 왼쪽으로 넘긴다.
 * 손가락·포인터가 올라가 있거나 키보드 포커스가 있으면 멈추고, 동작 줄이기 설정이면 자동으로 넘기지 않는다.
 * 하단 점: 기본 회색, 현재 장은 primary. 점을 누르면 그 장으로 이동한다.
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
      <div className={styles.noticeViewport}>
        <div
          className={styles.noticeTrack}
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {notices.map((notice, i) => (
            <Link
              key={notice.id}
              href={`/resident/notice/${notice.id}`}
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
