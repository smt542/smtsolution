"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { kakaoStubLogin } from "@/lib/resident/onboardingClient";

import styles from "./login.module.css";

export default function ResidentLoginPage() {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSheetOpen(false);
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  const continueWithMatchedIdentity = async () => {
    setSheetOpen(false);
    await kakaoStubLogin();
    router.push("/resident/auth");
  };

  return (
    <>
      <div className={styles.glow} />
      <div className={styles.top}>
        <div className={styles.brand}>
          <Image src="/logo-mark.png" alt="" width={26} height={26} />
          <b>
            관리<em>비서</em>
          </b>
        </div>
        <h1 className={styles.h1}>
          이번 달 관리비,
          <br />
          <span>앱에서 바로 확인</span>하세요
        </h1>
        <p className={styles.lead}>
          고지서 없이도 항목별 금액과 납부일까지
          <br />
          한눈에. 납부 계좌도 바로 복사해요.
        </p>
      </div>
      <div className={styles.stagearea}>
        <div className={styles.cards}>
          <div className={styles.cardB} />
          <div className={styles.card}>
            <div className={styles.cardIn}>
              <div className={styles.cw}>
                <span>2026년 8월 관리비</span>
                <span className={`${styles.chip} ${styles.ok}`}>납부 완료</span>
              </div>
              <div className={styles.amt}>
                128,400<i>원</i>
              </div>
              <div className={styles.meta}>8월 21일 납부 · 그린빌라 201호</div>
              <div className={styles.split} />
              <div className={styles.mini}>
                <span>일반관리비</span>
                <b>62,000원</b>
              </div>
              <div className={styles.mini}>
                <span>전기</span>
                <b>38,700원</b>
              </div>
              <div className={styles.mini}>
                <span>수도 · 가스</span>
                <b>27,700원</b>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.foot}>
        <button
          type="button"
          className={styles.kakao}
          onClick={() => setSheetOpen(true)}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3.6c-4.86 0-8.8 3.02-8.8 6.75 0 2.4 1.62 4.51 4.06 5.72l-.98 3.6c-.9.33.25.6.53.43l4.32-2.84c.28.02.57.04.87.04 4.86 0 8.8-3.02 8.8-6.95S16.86 3.6 12 3.6z" />
          </svg>
          카카오톡으로 3초 만에 시작
        </button>
        <div className={styles.note}>
          <a href="#">이용약관</a> · <a href="#">개인정보 처리방침</a>에
          동의하고 시작합니다
        </div>
      </div>

      <div
        className={`${styles.sheet} ${sheetOpen ? styles.show : ""}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setSheetOpen(false);
          }
        }}
      >
        <div className={styles.sheetB}>
          <div className={styles.grab} />
          <div className={styles.sheetT}>카카오 로그인으로 연결할까요?</div>
          <div className={styles.sheetD}>
            카카오톡에 등록된 휴대폰 번호로 세대 정보를 자동으로 찾아드려요.
          </div>
          <button
            type="button"
            className={styles.sheetBtn}
            onClick={continueWithMatchedIdentity}
          >
            계속하기
          </button>
        </div>
      </div>
    </>
  );
}
