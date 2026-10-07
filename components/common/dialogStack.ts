"use client";

import { useEffect, useRef } from "react";

/**
 * 열린 대화상자(Modal·ConfirmDialog)의 스택.
 * - ESC는 가장 위(마지막에 열린) 대화상자 하나만 처리한다. 모달 안에서 띄운 확인창에서
 *   ESC를 눌러도 부모 모달까지 닫히지 않는다.
 * - body 스크롤 잠금은 카운터로 관리한다. 확인창이 닫혀도 부모 모달이 열려 있으면 잠금을 유지한다.
 */
const stack: symbol[] = [];
const handledEvents = new WeakSet<Event>();
let lockCount = 0;
let prevBodyOverflow = "";

function lockBodyScroll() {
  if (lockCount === 0) {
    prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
}

function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = prevBodyOverflow;
}

/** open 동안 대화상자 레이어를 등록하고, 최상단일 때만 ESC로 onEscape를 호출한다. */
export function useDialogLayer(open: boolean, onEscape: () => void) {
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!open) return;
    const id = Symbol("dialog");
    stack.push(id);
    lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // 같은 ESC 이벤트로 최상단이 닫힌 뒤 아래 레이어가 이어서 닫히지 않도록 한 번만 처리한다.
      if (handledEvents.has(e)) return;
      if (stack[stack.length - 1] !== id) return;
      handledEvents.add(e);
      onEscapeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const idx = stack.lastIndexOf(id);
      if (idx >= 0) stack.splice(idx, 1);
      unlockBodyScroll();
    };
  }, [open]);
}
