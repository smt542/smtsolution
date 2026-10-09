"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";
import {
  automatch,
  loadSession,
  myLink,
  pendingState,
} from "@/lib/resident/onboardingClient";

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
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    const wait = (milliseconds: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, milliseconds));
      });

    const run = async () => {
      setStepIndex(0);
      const session = await loadSession();
      if (cancelled) return;
      if (!session) {
        router.replace("/resident/login");
        return;
      }

      const [link, pending] = await Promise.all([myLink(), pendingState()]);
      if (cancelled) return;
      if (link) {
        router.replace("/resident/home");
        return;
      }
      if (pending) {
        router.replace("/resident/pending");
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

    // 조회 실패 시 스피너에 멈추지 않고 재시도 안내를 보여준다(정책: 본인인증·세대 매칭 "조회 실패(서버)").
    void run().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [router, attempt]);

  const step = STEPS[stepIndex];

  if (failed) {
    return (
      <ResidentAsyncState
        variant="compact"
        role="alert"
        message={<b>세대 정보를 불러오지 못했어요.</b>}
        retryLabel="다시 시도"
        onRetry={() => {
          setFailed(false);
          setAttempt((value) => value + 1);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[22px] px-8">
      <div className="relative size-[74px] animate-[pop_0.4s_cubic-bezier(0.22,0.61,0.36,1)_both]">
        <i className="absolute inset-0 animate-spin rounded-full border-[3px] border-blue-t border-t-blue" />
        <Image className="absolute inset-0 m-auto size-[34px] object-contain" src="/logo-mark.png" alt="" width={34} height={34} />
      </div>
      <div className="text-center animate-[rise_0.5s_100ms_cubic-bezier(0.22,0.61,0.36,1)_both]">
        <b className="block text-lg font-extrabold tracking-[-0.02em]">{step.title}</b>
        <span className="mt-2 block text-sm font-semibold leading-[1.6] text-t3">{step.description}</span>
      </div>
      <div className="mt-1 flex gap-1.5 animate-[rise_0.5s_160ms_cubic-bezier(0.22,0.61,0.36,1)_both]">
        {STEPS.map((item, index) => (
          <i key={item.title} className={`size-1.5 rounded-full ${index <= stepIndex ? "bg-blue" : "bg-line"}`} />
        ))}
      </div>
    </div>
  );
}
