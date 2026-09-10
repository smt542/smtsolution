"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import OnboardingPageScaffold from "@/app/(resident)/_components/OnboardingPageScaffold";
import { normalizePhone } from "@/lib/format";
import { loadSession, logout } from "@/lib/resident/onboardingClient";

import styles from "./nomatch.module.css";

function maskPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length >= 7) {
    return `${normalized.slice(0, 3)}-****-${normalized.slice(-4)}`;
  }
  return normalized;
}

export default function ResidentNomatchClient({
  children,
  icon,
}: {
  children: ReactNode;
  icon: ReactNode;
}) {
  const router = useRouter();
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadResidentSession = async () => {
      const session = await loadSession();

      if (!session) {
        router.replace("/resident/login");
        return;
      }

      await Promise.resolve();

      if (!cancelled) {
        setMaskedPhone(
          session.identity.phone
            ? maskPhone(session.identity.phone)
            : "연락처 미제공",
        );
      }
    };

    void loadResidentSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!maskedPhone) return null;

  const retryLogin = async () => {
    await logout();
    router.push("/resident/login");
  };

  return (
    <OnboardingPageScaffold
      variant="block"
      title={
        <>
          등록된 세대를
          <br />
          찾지 못했어요
        </>
      }
      lead={
        <>
          <b className={styles.num}>{maskedPhone}</b> 번호로 연결된 세대가 없어요.
          <br />
          관리사무소에 등록한 번호의 카카오 계정으로
          <br />
          다시 로그인해 주세요.
        </>
      }
      icon={icon}
      footer={
        <button
          type="button"
          className={`${styles.btn} ${styles.pri}`}
          onClick={retryLogin}
        >
          다른 카카오 계정으로 로그인
        </button>
      }
    >
      {children}
    </OnboardingPageScaffold>
  );
}
