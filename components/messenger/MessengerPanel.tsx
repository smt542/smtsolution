"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { messengerClasses as styles } from "./messengerClasses";
import type { ChannelMode } from "./types";

interface Props {
  channel: ChannelMode;
  minimized: boolean;
  /** 닫기를 확인해 닫히는 전환(0.2초)이 도는 중. 끝나면 onClosed 를 부른다. */
  closing?: boolean;
  onClosed?: () => void;
  pos: { x: number; y: number } | null;
  onChannel: (channel: ChannelMode) => void;
  onMin: () => void;
  onClose: () => void;
  onPos: (pos: { x: number; y: number } | null) => void;
  onSend?: () => void;
  sendLabel?: string;
  sendDisabled?: boolean;
  sending?: boolean;
  children?: React.ReactNode;
}

export function MessengerPanel({
  channel,
  minimized,
  closing = false,
  onClosed,
  pos,
  onChannel,
  onMin,
  onClose,
  onPos,
  onSend,
  sendLabel = "수신자를 선택해 주세요",
  sendDisabled = true,
  sending = false,
  children,
}: Props) {
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const shown = !minimized && !closing;

  // 정본 openFmp: 열 때마다 패널이 화면 가장자리 8px 안쪽을 넘으면 첫 위치(FAB 자리)로 되돌린다.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!shown || !panel) return;
    const style = getComputedStyle(panel);
    const right = parseFloat(style.right);
    const bottom = parseFloat(style.bottom);
    const left = window.innerWidth - right - panel.offsetWidth;
    const top = window.innerHeight - bottom - panel.offsetHeight;
    if (left < 8 || top < 8 || right < 8 || bottom < 8) onPos(null);
  }, [shown, onPos]);

  const onPointerDown = (event: React.PointerEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const base = pos ?? { x: 0, y: 0 };
    drag.current = {
      dx: event.clientX - base.x,
      dy: event.clientY - base.y,
    };
    setDragging(true);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const panel = panelRef.current;
    if (!drag.current || !panel) return;
    // 정본 pointermove: 끄는 동안 패널이 화면 밖으로 나가지 않게 가둔다(left 0~innerWidth-w, top 0~innerHeight-h).
    // 위치는 right = 22 - x, bottom = 22 - y 라서 x·y 의 범위로 바꿔 건다.
    const x = Math.min(22, Math.max(panel.offsetWidth + 22 - window.innerWidth, event.clientX - drag.current.dx));
    const y = Math.min(22, Math.max(panel.offsetHeight + 22 - window.innerHeight, event.clientY - drag.current.dy));
    onPos({ x, y });
  };

  const onPointerUp = (event: React.PointerEvent) => {
    drag.current = null;
    setDragging(false);
    try {
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
  };

  // 첫 위치 = FAB 자리(right 22·bottom 22). 끌어 옮긴 만큼 right·bottom 을 줄인다 — transform 은
  // 열기·닫기 전환이 쓰고, 열린 상태는 transform:none 이어야 안쪽 fixed 메뉴가 뷰포트 기준으로 뜬다.
  const panelStyle = {
    right: 22 - (pos?.x ?? 0),
    bottom: 22 - (pos?.y ?? 0),
  };

  return (
    <>
      {minimized && (
      <div
        className={`${styles["fmp-bubble"]} ${styles["show"]}`}
        onClick={onMin}
        role="button"
        aria-label="메신저 펼치기"
      >
        <div className={styles["ring"]}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className={styles["bt"]}>문자·알림톡 발송</div>
          {/* 정본 minFmp: '작성 중'(발송 중이면 '발송 중') · 발송 버튼 문구 */}
          <div className={styles["bs"]}>
            {sending ? "발송 중" : "작성 중"} · {sendLabel}
          </div>
        </div>
      </div>
      )}
    <div
      ref={panelRef}
      className={`${styles["fmp"]} ${shown ? styles["fmp-show"] : styles["fmp-off"]}`}
      style={panelStyle}
      role="dialog"
      aria-modal="false"
      aria-label="문자·알림톡 발송"
      onTransitionEnd={(event) => {
        if (closing && event.target === event.currentTarget && event.propertyName === "opacity") {
          onClosed?.();
        }
      }}
    >
      <div
        className={`${styles["fmp-h"]} ${dragging ? styles.drag : styles.grab}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className={styles["dot"]}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className={styles["t"]}>문자·알림톡 발송</div>
          <div className={styles["sub"]}>화면을 보면서 발송할 수 있어요</div>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          aria-label="최소화"
          title="최소화"
          onClick={onMin}
          className={styles["fmp-ic"]}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
          >
            <path d="M5 12h14" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="닫기"
          title="닫기"
          onClick={onClose}
          className={styles["fmp-ic"]}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div
        className={`${styles["fmp-body"]} ${channel === "alim" ? styles["chan-alim"] : ""}`}
      >
        <div className={styles["fmp-seg"]}>
          <div
            className={
              channel === "sms"
                ? `${styles["si"]} ${styles["seg-on"]}`
                : `${styles["si"]} text-t3`
            }
            onClick={() => onChannel("sms")}
          >
            문자(SMS)
          </div>
          <div
            className={
              channel === "alim"
                ? `${styles["si"]} ${styles["seg-on"]}`
                : `${styles["si"]} text-t3`
            }
            onClick={() => onChannel("alim")}
          >
            알림톡
          </div>
        </div>
        {children}
      </div>

      <div className={styles["fmp-f"]}>
        <button
          type="button"
          className={`${styles["fmp-send"]} ${sending ? styles.sending : ""}`}
          onClick={onSend}
          disabled={sendDisabled || sending}
          style={{ opacity: sendDisabled ? 0.45 : undefined }}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
          </svg>
          <span>{sending ? "발송 중…" : sendLabel}</span>
        </button>
      </div>
    </div>
    </>
  );
}
