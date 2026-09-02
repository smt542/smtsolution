"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import OnboardingPageScaffold from "@/app/(resident)/_components/OnboardingPageScaffold";

import styles from "./notify.module.css";

export default function ResidentNotifyPage() {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  return (
    <OnboardingPageScaffold
      variant="flow"
      onBack={() => router.push("/resident/verify")}
      backLabel="이전 화면"
      title="알림을 받아보세요"
      lead={
        <>
          관리비가 확정되거나 건물 공지가 올라오면
          <br />
          카카오톡으로 바로 알려드려요.
        </>
      }
      footer={
        <button
          type="button"
          className={`${styles.btn} ${styles.pri}`}
          onClick={() => router.push("/resident/home")}
        >
          시작하기
        </button>
      }
    >
      <div className={styles.items}>
        <div className={styles.it}>
          <div className={styles.ic}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 5h10l4 4v10H5z" />
              <path d="M8 12h8M8 16h5" />
            </svg>
          </div>
          <div className={styles.tx}>
            <b>알림톡 받기</b>
            <span>관리비 발행과 건물 공지를 알려드려요</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="알림톡 받기"
            aria-checked={notificationsEnabled}
            className={`${styles.sw} ${
              notificationsEnabled ? styles.on : ""
            }`}
            onClick={() => setNotificationsEnabled((enabled) => !enabled)}
          >
            <i />
          </button>
        </div>
      </div>
      <div className={styles.note}>
        알림은 언제든 내 정보에서 다시 끄고 켤 수 있어요.
      </div>
    </OnboardingPageScaffold>
  );
}
