"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ConfirmDialog, type ConfirmOptions } from "./ConfirmDialog";

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false); // 열려 있던 확인창은 취소로 정리
      resolverRef.current = resolve;
      setOptions(next);
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={options !== null}
        title={options?.title ?? ""}
        description={options?.description}
        confirmLabel={options?.confirmLabel}
        cancelLabel={options?.cancelLabel}
        variant={options?.variant}
        look={options?.look}
        hideCancel={options?.hideCancel}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

const fallbackConfirm: ConfirmFn = (options) =>
  Promise.resolve(
    typeof window !== "undefined"
      ? window.confirm(
          typeof options.description === "string" ? options.description : options.title,
        )
      : false,
  );

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext) ?? fallbackConfirm;
}
