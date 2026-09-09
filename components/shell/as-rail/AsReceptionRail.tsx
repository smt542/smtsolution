"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { complaintKeys } from "@/hooks/reactquery/complaints";
import { staffMoveOutKeys } from "@/hooks/reactquery/staffMoveOut/keys";

import { AsReportModal } from "./AsReportModal";
import { AsReceptionList } from "./AsReceptionList";
import styles from "./AsRail.module.css";
import { MoveOutList } from "./MoveOutList";
import { useRailOpen } from "./useRailOpen";

type RailTab = "as" | "mv";

function classNames(...values: Array<string | false>) {
  return values.filter(Boolean).join(" ");
}

export function AsReceptionRail() {
  const { open, toggle } = useRailOpen();
  const [tab, setTab] = useState<RailTab>("as");
  const [reportOpen, setReportOpen] = useState(false);
  const queryClient = useQueryClient();

  const chooseTab = (next: RailTab) => setTab(next);
  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLAnchorElement>,
    next: RailTab,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      chooseTab(next);
    }
  };
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: complaintKeys.all });
    void queryClient.invalidateQueries({ queryKey: staffMoveOutKeys.all });
  };

  return (
    <aside
      aria-label="A/S 접수·퇴실 신청 현황"
      className={`hidden print:hidden lg:block ${styles.railScope}`}
    >
      <button
        type="button"
        className={classNames(
          styles.rnbHandle,
          !open && styles.rnbHandleOff,
        )}
        title="A/S 접수 현황"
        aria-label={open ? "A/S 접수 현황 닫기" : "A/S 접수 현황 열기"}
        aria-expanded={open}
        onClick={toggle}
        data-testid="as-rail-handle"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 4h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2V5a1 1 0 0 1 1-1z" />
          <path d="M9 12h6M9 16h4" />
        </svg>
      </button>
      <div
        className={classNames(styles.rnb, !open && styles.rnbOff)}
        data-testid="as-rail-panel"
      >
        <div className={styles.rnbH}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--blue)"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 4h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2V5a1 1 0 0 1 1-1z" />
            <path d="M9 12h6M9 16h4" />
          </svg>
          <div className={styles.t}>A/S 접수·퇴실 신청 현황</div>
          <div className={styles.rnbActs}>
            <button
              type="button"
              className={styles.rnbBtn}
              title="새로고침"
              aria-label="A/S 접수·퇴실 신청 새로고침"
              onClick={refresh}
            >
              새로고침
            </button>
            <button
              type="button"
              className={styles.rnbBtn}
              title="출력"
              aria-label="A/S 접수 현황 출력"
              hidden={tab === "mv"}
              onClick={() => setReportOpen(true)}
            >
              인쇄
            </button>
          </div>
        </div>
        <div className={styles.rnbTabs} role="tablist">
          <a
            className={tab === "as" ? styles.on : ""}
            role="tab"
            tabIndex={0}
            aria-selected={tab === "as"}
            onClick={() => chooseTab("as")}
            onKeyDown={(event) => handleTabKeyDown(event, "as")}
          >
            A/S 접수
          </a>
          <a
            className={tab === "mv" ? styles.on : ""}
            role="tab"
            tabIndex={0}
            aria-selected={tab === "mv"}
            onClick={() => chooseTab("mv")}
            onKeyDown={(event) => handleTabKeyDown(event, "mv")}
          >
            퇴실 신청
          </a>
        </div>
        {tab === "as" ? <AsReceptionList /> : <MoveOutList />}
      </div>
      <AsReportModal open={reportOpen} onClose={() => setReportOpen(false)} />
    </aside>
  );
}
