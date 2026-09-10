"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { automatch, loadSession } from "@/lib/resident/onboardingClient";

import styles from "./auth.module.css";

const STEPS = [
  { title: "카카오 계정으로 확인 중", description: "잠시만 기다려 주세요" },
  {
    title: "세대 정보를 찾고 있어요",
    description: "연락처로 등록된 세대를 조회해요",
  },
  { title: "거의 다 됐어요", description: "확인 화면으로 이동합니다" },
] as const;

export default function ResidentAuthFlow() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    const wait = (milliseconds: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, milliseconds));
      });

    const run = async () => {
      const session = await loadSession();
      if (cancelled) return;
      if (!session) {
        router.replace("/resident/login");
        return;
      }

      const candidatesPromise = automatch();

      await wait(900);
      if (cancelled) return;
      setStepIndex(1);

      await wait(900);
      if (cancelled) return;
      setStepIndex(2);

      await wait(500);
      const candidates = await candidatesPromise;
      if (cancelled) return;

      router.replace(
        candidates.length > 0 ? "/resident/verify" : "/resident/nomatch",
      );
    };

    void run();

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [router]);

  const step = STEPS[stepIndex];

  return (
    <div className={styles.auth}>
      <div className={styles.ring}>
        <i />
        <Image src="/logo-mark.png" alt="" width={34} height={34} />
      </div>
      <div className={styles.msg}>
        <b>{step.title}</b>
        <span>{step.description}</span>
      </div>
      <div className={styles.steps}>
        {STEPS.map((item, index) => (
          <i key={item.title} className={index <= stepIndex ? styles.on : ""} />
        ))}
      </div>
    </div>
  );
}
