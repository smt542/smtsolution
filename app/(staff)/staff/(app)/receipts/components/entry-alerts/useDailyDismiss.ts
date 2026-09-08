"use client";

import { useCallback, useSyncExternalStore } from "react";

const DISMISS_EVENT = "receipts-entry-alert-dismissed";

function subscribe(onStoreChange: () => void): () => void {
  const listener = () => onStoreChange();
  window.addEventListener("storage", listener);
  window.addEventListener(DISMISS_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(DISMISS_EVENT, listener);
  };
}

/** SSR/최초 렌더에서는 '해제됨'으로 보아 팝업 깜빡임을 막는다. */
function getServerSnapshot(): boolean {
  return true;
}

/**
 * "오늘 그만보기" 일별 해제 상태 훅.
 * localStorage[key] === today 이면 오늘은 해제된 것으로 본다. 탭 간 동기화(storage + custom event) 포함.
 */
export function useDailyDismiss(storageKey: string | null, today: string) {
  const getSnapshot = useCallback(() => {
    if (!storageKey) return true;
    try {
      return localStorage.getItem(storageKey) === today;
    } catch {
      return false;
    }
  }, [storageKey, today]);

  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const dismiss = useCallback(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, today);
      window.dispatchEvent(new Event(DISMISS_EVENT));
    } catch {
      // 저장 실패 시 다음 진입 때 다시 표시한다.
    }
  }, [storageKey, today]);

  return { dismissed, dismiss };
}
