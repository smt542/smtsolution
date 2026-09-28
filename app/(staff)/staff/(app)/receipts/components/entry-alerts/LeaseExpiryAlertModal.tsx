"use client";

import type { UpcomingLeaseExpiry } from "@/hooks/reactquery/entryAlerts";
import { EntryAlertCard } from "./EntryAlertCard";
import { EntryAlertModal } from "./EntryAlertModal";
import { formatDotDate, householdLabel } from "./format";

/** "임대 만료 예정 세대" 진입 알림 모달 (Figma 669-5211). */
export function LeaseExpiryAlertModal({
  expiries,
  actionHref,
  onClose,
  onCloseAll,
  onDismissToday,
}: {
  expiries: UpcomingLeaseExpiry[];
  actionHref?: string;
  onClose: () => void;
  onCloseAll: () => void;
  onDismissToday: () => void;
}) {
  return (
    <EntryAlertModal
      title="임대 만료 예정 세대"
      subtitle={`임대 계약 만료가 다가온 세대가 ${expiries.length}건 있어요.`}
      actionHref={actionHref}
      onClose={onClose}
      onCloseAll={onCloseAll}
      onDismissToday={onDismissToday}
    >
      {expiries.map((expiry) => (
        <EntryAlertCard
          key={expiry.leaseId}
          title={householdLabel(expiry)}
          subtitle={`만료예정 ${formatDotDate(expiry.endDate)} · D-${expiry.daysLeft}`}
          trailing={
            <span className="shrink-0 rounded-[7px] bg-amber-t px-[9px] py-[3px] text-[12px] font-bold leading-[16.8px] text-amber">
              만료 임박
            </span>
          }
        />
      ))}
    </EntryAlertModal>
  );
}
