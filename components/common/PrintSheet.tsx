"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

const BASE_PRINT_CSS = `
@media screen {
  #__PRINT_SHEET_ID__ { display: none; }
}
@media print {
  html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
  body > *:not(#__PRINT_SHEET_ID__) { display: none !important; }
  #__PRINT_SHEET_ID__ {
    display: block !important;
    position: static !important;
    background: #fff !important;
    color: #000 !important;
    line-height: normal;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
`;

export function PrintSheet({
  id,
  css,
  ready = true,
  onDone,
  children,
}: {
  id: string;
  css: string;
  ready?: boolean;
  onDone: () => void;
  children: ReactNode;
}) {
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!ready) return;

    let closed = false;
    let closeTimer: number | undefined;
    const close = () => {
      if (closed) return;
      closed = true;
      if (closeTimer !== undefined) window.clearTimeout(closeTimer);
      window.removeEventListener("afterprint", close);
      onDoneRef.current();
    };

    window.addEventListener("afterprint", close);
    const printTimer = window.setTimeout(() => {
      try {
        window.print();
      } finally {
        closeTimer = window.setTimeout(close, 1500);
      }
    }, 0);

    return () => {
      window.clearTimeout(printTimer);
      if (closeTimer !== undefined) window.clearTimeout(closeTimer);
      window.removeEventListener("afterprint", close);
    };
  }, [ready]);

  if (typeof document === "undefined") return null;

  const scopedBaseCss = BASE_PRINT_CSS.replaceAll("#__PRINT_SHEET_ID__", `#${id}`);
  return createPortal(
    <>
      <style>{`${scopedBaseCss}${css}\n}`}</style>
      <div id={id}>{children}</div>
    </>,
    document.body,
  );
}
