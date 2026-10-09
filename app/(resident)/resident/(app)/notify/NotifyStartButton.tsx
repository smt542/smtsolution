"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { showResidentToast } from "@/app/(resident)/_components/residentToast";
import { useSetNotifyPrefs } from "@/hooks/reactquery/residentProfile";

import { useNotifyChoice } from "./NotificationSwitch";

/** 「시작하기」: 스위치에서 고른 알림 수신 여부를 저장한 뒤 홈으로 이동한다. */
export default function NotifyStartButton({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { enabled } = useNotifyChoice();
  const setNotifyPrefs = useSetNotifyPrefs();

  const start = async () => {
    try {
      await setNotifyPrefs.mutateAsync({ alimtalk: enabled });
      router.push(href);
    } catch {
      showResidentToast("알림 설정을 저장하지 못했어요. 다시 시도해 주세요");
    }
  };

  return (
    <button type="button" className={className} disabled={setNotifyPrefs.isPending} onClick={() => void start()}>
      {children}
    </button>
  );
}
