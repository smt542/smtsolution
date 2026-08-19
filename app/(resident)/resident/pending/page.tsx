"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  getPendingInfo,
  type PendingInfo,
} from "@/lib/resident/onboardingClient";

import styles from "./pending.module.css";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatRequestedAt(value: string): string {
  const date = new Date(value);

  return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(
    date.getDate(),
  )} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export default function ResidentPendingPage() {
  const router = useRouter();
  const [pendingInfo, setPendingInfo] = useState<PendingInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPendingInfo = async () => {
      const pending = getPendingInfo();

      if (!pending) {
        router.replace("/resident/login");
        return;
      }

      await Promise.resolve();

      if (!cancelled) {
        setPendingInfo(pending);
      }
    };

    void loadPendingInfo();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!pendingInfo) return null;

  const household =
    `${pendingInfo.buildingName} ${pendingInfo.unitNo}`.trim() ||
    "건물 확인 요청";

  return (
    <>
      <div className={styles.body}>
        <div className={styles.ring}>
          <div className={styles.wave} />
          <div className={styles.core}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 2" />
            </svg>
          </div>
        </div>
        <h1 className={styles.h1}>확인 요청을 보냈어요</h1>
        <p className={styles.lead}>
          관리사무소에서 세대를 확인하면
          <br />
          알림으로 알려드려요. 보통 1영업일 안에 처리돼요.
        </p>
        <div className={styles.card}>
          <div className={styles.r}>
            <span>요청 세대</span>
            <b>{household}</b>
          </div>
          <div className={styles.r}>
            <span>요청 일시</span>
            <b className={styles.num}>
              {formatRequestedAt(pendingInfo.requestedAt)}
            </b>
          </div>
        </div>
      </div>
      <div className={styles.foot}>
        <button
          type="button"
          className={`${styles.btn} ${styles.pri}`}
          onClick={() => router.push("/resident/login")}
        >
          로그인 화면으로
        </button>
      </div>
    </>
  );
}
