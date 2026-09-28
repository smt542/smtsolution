"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncActionController {
  error: unknown;
  isPending: boolean;
  reset: () => void;
  run: <T>(action: () => Promise<T>) => Promise<T>;
}

export function useAsyncAction(): AsyncActionController {
  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<unknown> | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // StrictMode(개발)는 effect를 해제했다가 다시 붙인다. 다시 붙을 때 true로 돌려놓지 않으면
  // 첫 해제 뒤로 영영 unmounted로 남아 isPending이 false로 안 돌아온다.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(<T,>(action: () => Promise<T>): Promise<T> => {
    if (inFlightRef.current) return inFlightRef.current as Promise<T>;

    setIsPending(true);
    setError(null);

    const promise = Promise.resolve().then(action);
    inFlightRef.current = promise;

    void promise.then(
      () => {
        if (mountedRef.current && inFlightRef.current === promise) {
          setIsPending(false);
        }
      },
      (nextError: unknown) => {
        if (mountedRef.current && inFlightRef.current === promise) {
          setError(nextError);
          setIsPending(false);
        }
      },
    ).finally(() => {
      if (inFlightRef.current === promise) inFlightRef.current = null;
    });

    return promise;
  }, []);

  const reset = useCallback(() => {
    if (!inFlightRef.current) setError(null);
  }, []);

  return { error, isPending, reset, run };
}
