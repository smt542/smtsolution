"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TOAST_MS = 1700;

/**
 * 현장관리자 앱 토스트 상태. 정본 `toast()`처럼 새 문구가 오면 바꿔 끼우고 1.7초를 다시 잰다(쌓지 않음).
 * 문구는 `<PartnerToast message={toastMessage} />`로 그린다.
 */
export function usePartnerToast() {
  const [toastMessage, setToastMessage] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const showToast = useCallback((message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToastMessage(message);
    timerRef.current = setTimeout(() => setToastMessage(""), TOAST_MS);
  }, []);

  return { toastMessage, showToast };
}

/**
 * 정본 `#adToast`·`#anToast`: 화면 아래 96px 가운데 검은 알약, 14px/700.
 * 알림 영역은 늘 두고 문구만 바꾼다 — 스크린리더가 새 문구를 읽게 하려는 것이다.
 * z-[200]: 파트너 화면의 전체 화면 모달(이사정산 내역서 z-[140] 등)보다 위에 떠야 모달 안 동작 결과가 보인다.
 */
export function PartnerToast({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${message ? "" : "hidden"} fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 whitespace-nowrap rounded-[13px] bg-[#191F28] px-5 py-[13px] text-[14px] font-bold leading-[normal] text-white`}
    >
      {message}
    </div>
  );
}
