"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  logout,
  myLink,
  type MyLink,
} from "@/lib/resident/onboardingClient";

import styles from "./home.module.css";

const MENU_ITEMS = [
  {
    label: "관리비 확인",
    description: "월별 관리비와 납부 내역을 확인해요",
  },
  {
    label: "공지사항",
    description: "우리 건물의 새 소식을 확인해요",
  },
  {
    label: "퇴실 신청",
    description: "퇴실 일정을 신청하고 확인해요",
  },
  {
    label: "고지서 신청",
    description: "관리비 고지서 수령 방법을 신청해요",
  },
] as const;

export default function ResidentHomePage() {
  const router = useRouter();
  const toastTimer = useRef<number | null>(null);
  const [link, setLink] = useState<MyLink | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadLink = async () => {
      const currentLink = await myLink();

      if (cancelled) return;

      if (!currentLink) {
        router.replace("/resident/login");
        return;
      }

      setLink(currentLink);
    };

    void loadLink();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) {
        window.clearTimeout(toastTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!logoutOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLogoutOpen(false);
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [logoutOpen]);

  if (!link) return null;

  const showComingSoon = (label: string) => {
    setToastMessage(`${label} 화면은 준비 중이에요`);

    if (toastTimer.current !== null) {
      window.clearTimeout(toastTimer.current);
    }

    toastTimer.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimer.current = null;
    }, 1600);
  };

  const confirmLogout = async () => {
    await logout();
    router.push("/resident/login");
  };

  return (
    <div className={styles.home}>
      <div className={styles.hdr}>
        <div className={styles.unit}>
          <b>{`${link.buildingName} ${link.unitNo}`}</b>
          <span>{link.tenantName} 님</span>
        </div>
        <button
          type="button"
          className={styles.ibtn}
          aria-label="로그아웃"
          onClick={() => setLogoutOpen(true)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 12H3" />
            <path d="M11 8l4 4-4 4" />
            <path d="M9 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9" />
          </svg>
        </button>
      </div>

      <div className={styles.scroll}>
        <div className={styles.as}>
          {MENU_ITEMS.map((item) => (
            <button
              type="button"
              className={styles.arow}
              key={item.label}
              onClick={() => showComingSoon(item.label)}
            >
              <span className={styles.at}>
                <b>{item.label}</b>
                <span>{item.description}</span>
              </span>
              <svg
                className={styles.chevron}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div
        className={`${styles.cf} ${logoutOpen ? styles.show : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setLogoutOpen(false);
          }
        }}
      >
        <div className={styles.cfB}>
          <div className={styles.cfT} id="logout-title">
            로그아웃 하시겠습니까?
          </div>
          <div className={styles.cfD}>
            현재 계정에서 로그아웃하고
            <br />
            로그인 화면으로 이동해요.
          </div>
          <div className={styles.cfA}>
            <button
              type="button"
              className={styles.cfBtn}
              onClick={() => setLogoutOpen(false)}
            >
              닫기
            </button>
            <button
              type="button"
              className={`${styles.cfBtn} ${styles.danger}`}
              onClick={confirmLogout}
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {toastMessage ? (
        <div className={`${styles.toast} ${styles.show}`} role="status">
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}
