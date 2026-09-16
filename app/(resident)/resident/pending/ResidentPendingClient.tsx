"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import OnboardingPageScaffold from "@/app/(resident)/_components/OnboardingPageScaffold";
import {
  getPendingInfo,
  type PendingInfo,
} from "@/lib/resident/onboardingClient";

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
          className="h-14 w-full rounded-2xl bg-blue text-[16.5px] font-bold tracking-[-0.02em] text-white transition-transform hover:bg-blue-d active:scale-[0.985]"
          onClick={() => router.push("/resident/login")}
        >
          로그인 화면으로
        </button>
      }
    >
      <div className="mt-[26px] w-full rounded-[18px] border border-line px-4 py-1.5 text-left animate-[rise_0.5s_160ms_cubic-bezier(0.22,0.61,0.36,1)_both]">
        <div className="flex items-center justify-between gap-2.5 border-b border-line2 py-3.5 text-[13.5px] font-semibold text-t3 last:border-b-0">
          <span>요청 세대</span>
          <b className="text-sm font-bold text-t1">{household}</b>
        </div>
        <div className="flex items-center justify-between gap-2.5 py-3.5 text-[13.5px] font-semibold text-t3">
          <span>요청 일시</span>
          <b className="text-sm font-bold text-t1 tabular-nums">
            {formatRequestedAt(pendingInfo.requestedAt)}
          </b>
        </div>
      </div>
    </OnboardingPageScaffold>
  );
}
