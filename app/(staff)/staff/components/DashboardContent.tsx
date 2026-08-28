"use client";

import Link from "next/link";
import { useCallback, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import {
  getKoreaToday,
  useDashboardOverview,
  type DashboardOverview,
} from "@/hooks/reactquery/dashboard";
import { formatNumber } from "@/lib/format";
import { MoveInNoticeModal } from "./MoveInNoticeModal";

const DISMISS_STORAGE_PREFIX = "home-erp:dashboard:move-in-dismissed";
const DISMISS_STORAGE_EVENT = "dashboard-move-in-dismissed";

export function getMoveInDismissStorageKey(orgId: number, username: string): string {
  return `${DISMISS_STORAGE_PREFIX}:${orgId}:${username}`;
}

function subscribeToDismissStorage(onStoreChange: () => void): () => void {
  const listener = () => onStoreChange();
  window.addEventListener("storage", listener);
  window.addEventListener(DISMISS_STORAGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(DISMISS_STORAGE_EVENT, listener);
  };
}

function getServerDismissedSnapshot(): boolean {
  return true;
}

const CARD_ICONS = {
  moveIn: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1zm4 8h2v2H9v-2z",
  complaints: "M4 5h16v11H9l-5 4V5zm4 4h8M8 12h5",
  overdue: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 5v5m0 3h.01",
} as const;

function SummaryCard({
  label,
  count,
  unit,
  hint,
  href,
  icon,
}: {
  label: string;
  count: number;
  unit: string;
  hint: string;
  href: string;
  icon: keyof typeof CARD_ICONS;
}) {
  return (
    <Link
      href={href}
      aria-label={`${label} ${count}${unit} 화면으로 이동`}
      className="group rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold text-t2">{label}</p>
          <p className="mt-3 text-3xl font-extrabold text-t1 num">
            {formatNumber(count)}
            <span className="ml-1 text-sm font-bold text-t3">{unit}</span>
          </p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-t2 text-brand transition group-hover:bg-brand group-hover:text-white">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d={CARD_ICONS[icon]} />
          </svg>
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3 border-t border-line2 pt-3">
        <p className="text-xs leading-5 text-t3">{hint}</p>
        <span className="shrink-0 text-xs font-extrabold text-brand">바로가기 →</span>
      </div>
    </Link>
  );
}

function SummaryCards({ overview }: { overview: DashboardOverview }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <SummaryCard
        label="오늘 입주예정"
        count={overview.todayMoveIns.length}
        unit="세대"
        hint="입주예정일이 오늘인 세대"
        href="/staff/buildings"
        icon="moveIn"
      />
      <SummaryCard
        label="미처리 AS"
        count={overview.pendingComplaintCount}
        unit="건"
        hint="접수 후 아직 처리 대기 중인 민원"
        href="/staff/receipts"
        icon="complaints"
      />
      <SummaryCard
        label="미납 세대"
        count={overview.overdueHouseholdCount}
        unit="세대"
        hint="확정 부과액 중 미납 잔액이 있는 세대"
        href="/staff/overdue"
        icon="overdue"
      />
    </div>
  );
}

function SummaryLoading() {
  return (
    <div
      role="status"
      aria-label="업무 요약을 불러오는 중"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {["오늘 입주예정", "미처리 AS", "미납 세대"].map((label) => (
        <div key={label} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <p className="text-sm font-extrabold text-t2">{label}</p>
          <div className="mt-3 h-9 w-24 animate-pulse rounded-lg bg-line2" />
          <div className="mt-4 h-10 animate-pulse rounded-lg border-t border-line2 bg-bg" />
        </div>
      ))}
    </div>
  );
}

export function DashboardContent() {
  const [today] = useState(getKoreaToday);
  const [popupClosed, setPopupClosed] = useState(false);
  const { data: me } = useMe();
  const { data, isPending, isError, refetch } = useDashboardOverview(today);
  const storageKey = me
    ? getMoveInDismissStorageKey(me.orgId, me.username)
    : null;
  const getDismissedSnapshot = useCallback(() => {
    if (!storageKey) return true;
    try {
      return localStorage.getItem(storageKey) === today;
    } catch {
      return false;
    }
  }, [storageKey, today]);
  const dismissedToday = useSyncExternalStore(
    subscribeToDismissStorage,
    getDismissedSnapshot,
    getServerDismissedSnapshot,
  );
  const popupOpen = Boolean(
    !popupClosed && !dismissedToday && data && data.todayMoveIns.length > 0,
  );

  const dismissToday = () => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, today);
        window.dispatchEvent(new Event(DISMISS_STORAGE_EVENT));
      } catch {
        // 저장 실패 시 팝업은 닫되 다음 진입 때 다시 표시한다.
      }
    }
    setPopupClosed(true);
  };

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <header>
        <p className="mb-1 text-xs font-bold text-t3">업무 홈</p>
        <h1 className="text-2xl font-extrabold text-t1">대시보드</h1>
        <p className="mt-2 text-sm text-t3">오늘 확인할 입주, 민원·AS, 미납 업무를 한눈에 확인하세요.</p>
      </header>

      <section aria-labelledby="work-summary-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="work-summary-title" className="text-base font-extrabold text-t1">업무 요약</h2>
          <span className="text-xs font-semibold text-t4">{today}</span>
        </div>

        {isPending ? (
          <SummaryLoading />
        ) : isError || !data ? (
          <div role="alert" className="rounded-2xl border border-red/20 bg-red-t p-8 text-center">
            <p className="text-sm font-semibold text-red">오류가 발생했습니다. 다시 시도해 주세요.</p>
            <Button type="button" variant="ghost" className="mt-4" onClick={() => void refetch()}>
              재시도
            </Button>
          </div>
        ) : (
          <SummaryCards overview={data} />
        )}
      </section>

      {popupOpen && data && (
        <MoveInNoticeModal
          moveIns={data.todayMoveIns}
          onClose={() => setPopupClosed(true)}
          onDismissToday={dismissToday}
        />
      )}
    </div>
  );
}
