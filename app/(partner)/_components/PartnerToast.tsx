"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 정본 현장 토스트(`toast()`)가 떠 있는 시간. */
const TOAST_MS = 1700;

/** 현장 앱 토스트 상태. `show`로 띄우면 1.7초 뒤 사라지고, 새로 띄우면 시간을 다시 잰다. */
export function usePartnerToast() {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: string) => {
    setMessage(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), TOAST_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { message, show };
}

type PartnerToastProps = {
  /** 빈 문자열이면 그리지 않는다. */
  message: string;
};

/** 정본 현장 토스트(검침 `#mtToast` 등): 화면 아래 96px 가운데, 어두운 알약. */
export function PartnerToast({ message }: PartnerToastProps) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-24 left-1/2 z-[130] -translate-x-1/2 whitespace-nowrap rounded-[13px] bg-[#191f28] px-5 py-[13px] text-[14px] font-bold leading-[normal] text-white"
    >
      {message}
    </div>
  );
}
