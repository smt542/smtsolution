"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/common";
import type { TodayMoveIn } from "@/hooks/reactquery/dashboard";
import { formatDate } from "@/lib/format";

function formatMoveInDate(value: string): string {
  return formatDate(value);
}

function unitLabel(moveIn: TodayMoveIn): string {
  return [moveIn.dong, moveIn.unitNo].filter(Boolean).join(" ");
}

export function MoveInNoticeModal({
  moveIns,
  onClose,
  onDismissToday,
}: {
  moveIns: TodayMoveIn[];
  onClose: () => void;
  onDismissToday: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-in-notice-title"
        aria-describedby="move-in-notice-description"
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-surface shadow-2xl"
      >
        <header className="border-b border-line px-5 py-5 sm:px-6">
          <p className="text-xs font-extrabold text-brand">오늘의 입주 일정</p>
          <h2 id="move-in-notice-title" className="mt-1 text-xl font-extrabold text-t1">
            오늘 입주예정 세대가 있습니다
          </h2>
          <p id="move-in-notice-description" className="mt-2 text-sm text-t3">
            입주예정 세대 {moveIns.length}곳을 확인해 주세요. 행을 누르면 입주자 상세로 이동합니다.
          </p>
        </header>

        <ul className="max-h-[52vh] divide-y divide-line overflow-y-auto px-3 py-2 sm:px-4">
          {moveIns.map((moveIn) => (
            <li key={moveIn.occupancyId}>
              <Link
                href={`/staff/buildings/${moveIn.buildingId}/tenants/${moveIn.unitId}`}
                onNavigate={onClose}
                aria-label={`${moveIn.buildingName} ${unitLabel(moveIn)} ${moveIn.tenantName || "입주자명 미등록"} ${formatMoveInDate(moveIn.moveInDate)}`}
                className="grid gap-2 rounded-xl px-3 py-3.5 transition hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:grid-cols-[minmax(0,1.35fr)_minmax(0,0.8fr)_auto] sm:items-center"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold text-t1">
                    {moveIn.buildingName}
                  </span>
                  <span className="mt-1 block truncate text-xs font-semibold text-t3">
                    {unitLabel(moveIn)}
                  </span>
                </span>
                <span className="truncate text-sm font-bold text-t2">
                  {moveIn.tenantName || "입주자명 미등록"}
                </span>
                <span className="text-xs font-bold text-brand num">
                  {formatMoveInDate(moveIn.moveInDate)}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <footer className="flex flex-col-reverse gap-2 border-t border-line bg-bg/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button autoFocus type="button" variant="ghost" onClick={onClose}>
            닫기
          </Button>
          <Button type="button" onClick={onDismissToday}>
            오늘 그만보기
          </Button>
        </footer>
      </section>
    </div>
  );
}
