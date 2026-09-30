"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { complaintKeys } from "@/hooks/reactquery/complaints";
import { staffMoveOutKeys } from "@/hooks/reactquery/staffMoveOut/keys";

import { AsReportModal } from "./AsReportModal";
import { AsReceptionList } from "./AsReceptionList";
import { MoveOutList } from "./MoveOutList";
import { RailRefreshBar } from "./RailRefreshIndicators";
import { useRailOpen } from "./useRailOpen";

type RailTab = "as" | "mv";

// 정본은 새로고침을 누르면 막대·스켈레톤을 1.2초 보여 준다. 다시 불러오기가 더 걸리면 끝날 때까지 유지한다.
const REFRESH_MIN_MS = 1200;

export function AsReceptionRail() {
  const { open, toggle } = useRailOpen();
  const [tab, setTab] = useState<RailTab>("as");
  const [reportOpen, setReportOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshSeq = useRef(0);
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
    // 다시 누르면 정본처럼 처음부터 다시 센다 — 앞선 새로고침의 완료는 무시한다.
    const seq = ++refreshSeq.current;
    setRefreshing(true);
    void Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: complaintKeys.all }),
      queryClient.invalidateQueries({ queryKey: staffMoveOutKeys.all }),
      new Promise((resolve) => setTimeout(resolve, REFRESH_MIN_MS)),
    ]).then(() => {
      if (refreshSeq.current === seq) setRefreshing(false);
    });
  };

  return (
    <aside
      aria-label="A/S 접수·퇴실 신청 현황"
      className="print:hidden"
    >
      {/* 좁은 화면에서도 핸들(30px)이 화면 안에 남도록 패널 폭을 100vw-30px로 제한하고, 핸들 위치도 같은 값을 따른다. */}
      <button
        type="button"
        className={`fixed top-1/2 -translate-y-1/2 z-[45] w-[30px] h-[70px] rounded-[12px_0_0_12px] bg-white border border-line border-r-0 flex items-center justify-center cursor-pointer text-t2 shadow-[-6px_0_16px_-8px_rgba(23,31,40,0.25)] transition-[right] duration-[180ms] [transition-timing-function:ease] hover:bg-bg hover:text-blue ${open ? "right-[min(404px,calc(100vw-30px))]" : "right-0"}`}
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
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="w-[18px] h-[18px]"
        >
          <path d="M9 4h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2V5a1 1 0 0 1 1-1z" />
          <path d="M9 12h6M9 16h4" />
        </svg>
      </button>
      <div
        className={`fixed top-0 right-0 h-screen w-[404px] max-w-[calc(100vw-30px)] z-[45] bg-white border-l border-line flex flex-col overflow-hidden transition-transform duration-[180ms] [transition-timing-function:ease] ${open ? "translate-x-0 shadow-[-14px_0_36px_-18px_rgba(23,31,40,0.3)]" : "translate-x-full shadow-none"}`}
        data-testid="as-rail-panel"
      >
        {refreshing ? <RailRefreshBar /> : null}
        <div className="h-[62px] flex-none flex items-center gap-2 px-[18px] border-b border-line">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-blue)"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 4h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2V5a1 1 0 0 1 1-1z" />
            <path d="M9 12h6M9 16h4" />
          </svg>
          <div className="text-[15px] font-extrabold whitespace-nowrap">A/S 접수·퇴실 신청 현황</div>
          <div className="inline-flex items-center gap-2 ml-auto">
            <button
              type="button"
              className="w-auto h-8 px-[13px] border border-blue rounded-[9px] inline-flex items-center justify-center text-[12.5px] font-bold text-blue bg-white cursor-pointer hover:bg-blue-t2 hover:text-blue-d"
              title="새로고침"
              aria-label="A/S 접수·퇴실 신청 새로고침"
              onClick={refresh}
            >
              새로고침
            </button>
            <button
              type="button"
              className="w-auto h-8 px-[13px] border border-blue rounded-[9px] inline-flex items-center justify-center text-[12.5px] font-bold text-blue bg-white cursor-pointer hover:bg-blue-t2 hover:text-blue-d"
              title="출력"
              aria-label="A/S 접수 현황 출력"
              hidden={tab === "mv"}
              onClick={() => setReportOpen(true)}
            >
              인쇄
            </button>
          </div>
        </div>
        <div className="flex-none flex gap-0.5 pt-2 px-3 pb-0 border-b border-line" role="tablist">
          <a
            className={`flex-1 justify-center pt-[9px] px-3 pb-[10px] text-[14px] font-semibold leading-[normal] cursor-pointer border-b-2 -mb-px whitespace-nowrap inline-flex items-center gap-1.5 ${tab === "as" ? "text-blue border-blue" : "text-t3 border-transparent"}`}
            role="tab"
            tabIndex={0}
            aria-selected={tab === "as"}
            onClick={() => chooseTab("as")}
            onKeyDown={(event) => handleTabKeyDown(event, "as")}
          >
            A/S 접수
          </a>
          <a
            className={`flex-1 justify-center pt-[9px] px-3 pb-[10px] text-[14px] font-semibold leading-[normal] cursor-pointer border-b-2 -mb-px whitespace-nowrap inline-flex items-center gap-1.5 ${tab === "mv" ? "text-blue border-blue" : "text-t3 border-transparent"}`}
            role="tab"
            tabIndex={0}
            aria-selected={tab === "mv"}
            onClick={() => chooseTab("mv")}
            onKeyDown={(event) => handleTabKeyDown(event, "mv")}
          >
            퇴실 신청
          </a>
        </div>
        {tab === "as" ? <AsReceptionList refreshing={refreshing} /> : <MoveOutList refreshing={refreshing} />}
      </div>
      <AsReportModal open={reportOpen} onClose={() => setReportOpen(false)} maskReporterPhones />
    </aside>
  );
}
