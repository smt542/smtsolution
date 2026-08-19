"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getSession, logout } from "@/lib/resident/onboardingClient";

import styles from "./nomatch.module.css";

function maskPhone(phone: string): string {
  const groups = phone.split("-");

  if (groups.length < 3) return phone;

  return `${groups[0]}-****-${groups[groups.length - 1]}`;
}

export default function ResidentNomatchPage() {
  const router = useRouter();
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      const session = getSession();

      if (!session) {
        router.replace("/resident/login");
        return;
      }

      await Promise.resolve();

      if (!cancelled) {
        setMaskedPhone(maskPhone(session.identity.phone));
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!maskedPhone) return null;

  const retryLogin = () => {
    logout();
    router.push("/resident/login");
  };

  return (
    <>
      <div className={styles.body}>
        <div className={styles.ic}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.2-3.2" />
            <path d="M11 8v3M11 14v.4" />
          </svg>
        </div>
        <h1 className={styles.h1}>
          등록된 세대를
          <br />
          찾지 못했어요
        </h1>
        <p className={styles.lead}>
          <b className={styles.num}>{maskedPhone}</b> 번호로 연결된 세대가 없어요.
          <br />
          관리사무소에 등록한 번호의 카카오 계정으로
          <br />
          다시 로그인해 주세요.
        </p>
        <div className={styles.why}>
          <div className={styles.w}>
            <div className={styles.n}>1</div>
            <div>
              <b>관리사무소에 등록된 번호가 다를 수 있어요</b>
              <span>계약서에 적은 번호와 카카오 계정 번호가 다른 경우예요</span>
            </div>
          </div>
          <div className={styles.w}>
            <div className={styles.n}>2</div>
            <div>
              <b>입주 등록이 아직 안 됐을 수 있어요</b>
              <span>입주 직후에는 관리사무소 등록까지 하루 정도 걸려요</span>
            </div>
          </div>
          <div className={styles.w}>
            <div className={styles.n}>3</div>
            <div>
              <b>세대주 명의가 가족일 수 있어요</b>
              <span>
                계약자 본인 번호로 가입된 카카오 계정으로 로그인해 주세요
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.foot}>
        <button
          type="button"
          className={`${styles.btn} ${styles.pri}`}
          onClick={retryLogin}
        >
          다른 카카오 계정으로 로그인
        </button>
      </div>
    </>
  );
}
