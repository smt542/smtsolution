"use client";

import { usePathname } from "next/navigation";
import styles from "./messenger.module.css";
import { useMessengerState } from "./useMessengerState";
import { MessengerPanel } from "./MessengerPanel";

export function MessengerFab() {
  const pathname = usePathname();
  const { ui, openPanel, closePanel, toggleMin, setPos, setChannel } =
    useMessengerState();

  if (!pathname.startsWith("/staff")) return null;

  return (
    <>
      {!ui.open && (
        <button
          type="button"
          aria-label="문자·알림톡 발송"
          className={styles["fmp-fab"]}
          onClick={openPanel}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
          </svg>
        </button>
      )}
      {ui.open && (
        <MessengerPanel
          channel={ui.channel}
          minimized={ui.minimized}
          pos={ui.pos}
          onChannel={setChannel}
          onMin={toggleMin}
          onClose={closePanel}
          onPos={setPos}
        />
      )}
    </>
  );
}
