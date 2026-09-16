"use client";

import { useRef } from "react";
import { messengerClasses as styles } from "./messengerClasses";
import type { ChannelMode } from "./types";

interface Props {
  channel: ChannelMode;
  minimized: boolean;
  pos: { x: number; y: number } | null;
  onChannel: (channel: ChannelMode) => void;
  onMin: () => void;
  onClose: () => void;
  onPos: (pos: { x: number; y: number }) => void;
  onSend?: () => void;
  sendLabel?: string;
  sendDisabled?: boolean;
  sending?: boolean;
  recipientCount?: number;
  children?: React.ReactNode;
}

export function MessengerPanel({
  channel,
  minimized,
  pos,
  onChannel,
  onMin,
  onClose,
  onPos,
  onSend,
  sendLabel = "수신자를 선택해 주세요",
  sendDisabled = true,
  sending = false,
  recipientCount = 0,
  children,
}: Props) {
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const base = pos ?? { x: 0, y: 0 };
    drag.current = {
      dx: event.clientX - base.x,
      dy: event.clientY - base.y,
    };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag.current) return;
    onPos({
      x: event.clientX - drag.current.dx,
      y: event.clientY - drag.current.dy,
    });
  };

  const onPointerUp = (event: React.PointerEvent) => {
    drag.current = null;
    try {
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
  };

  const panelStyle = {
    right: 22,
    bottom: 22,
    ...(pos
      ? { transform: `translate(${pos.x}px, ${pos.y}px)` }
      : undefined),
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
        <div style={{ minWidth: 0 }}>
          <div className={styles["bt"]}>문자·알림톡 발송</div>
          <div className={styles["bs"]}>작성 중 · {recipientCount}명</div>
        </div>
      </div>
      )}
    <div
      className={`${styles["fmp"]} ${!minimized ? styles.show : ""}`}
      style={panelStyle}
      role="dialog"
      aria-modal="false"
      aria-label="문자·알림톡 발송"
    >
      <div
        className={`${styles["fmp-h"]} ${styles["drag"]}`}
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
        <div style={{ minWidth: 0 }}>
          <div className={styles["t"]}>문자·알림톡 발송</div>
          <div className={styles["sub"]}>화면을 보면서 발송할 수 있어요</div>
        </div>
        <div style={{ flex: 1 }} />
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
