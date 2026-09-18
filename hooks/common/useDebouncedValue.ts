"use client";

import { useEffect, useState } from "react";

/**
 * 검색 입력의 표준 debounce 지연.
 *
 * 화면마다 300으로 따로 선언돼 있던 값을 한 곳으로 모았다. 검색 지연은 화면별로 다를 이유가
 * 없고, 바꿀 일이 생기면 여기 한 줄만 고치면 된다.
 */
export const SEARCH_DEBOUNCE_MS = 300;

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedValue(value),
      Math.max(0, delayMs),
    );

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}
