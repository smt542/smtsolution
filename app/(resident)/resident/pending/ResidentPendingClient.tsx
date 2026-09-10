"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import OnboardingPageScaffold from "@/app/(resident)/_components/OnboardingPageScaffold";
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

export function ResidentPendingClient({
  title,
  lead,
  icon,
}: {
  title: ReactNode;
  lead: ReactNode;
  icon: ReactNode;
}) {
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
    <OnboardingPageScaffold
      variant="center"
      title={title}
      lead={lead}
      icon={icon}
      footer={
        <button
          type="button"
          className={`${styles.btn} ${styles.pri}`}
          onClick={() => router.push("/resident/login")}
        >
          로그인 화면으로
        </button>
      }
    >
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
    </OnboardingPageScaffold>
  );
}
