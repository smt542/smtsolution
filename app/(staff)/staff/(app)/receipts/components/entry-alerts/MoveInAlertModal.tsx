"use client";

import type { TodayMoveIn } from "@/hooks/reactquery/entryAlerts";
import { EntryAlertCard } from "./EntryAlertCard";
import { EntryAlertModal } from "./EntryAlertModal";
import { formatDotDate, householdLabel } from "./format";

/** "오늘 입주 예정 세대" 진입 알림 모달 (Figma 669-4003). */
export function MoveInAlertModal({
  moveIns,
  actionHref,
  onClose,
  onCloseAll,
  onDismissToday,
}: {
  moveIns: TodayMoveIn[];
  actionHref?: string;
  onClose: () => void;
  onCloseAll: () => void;
  onDismissToday: () => void;
}) {
  return (
    <EntryAlertModal
      title="오늘 입주 예정 세대"
      subtitle={`입주예정일이 오늘인 세대가 ${moveIns.length}건 있어요.`}
      actionHref={actionHref}
      onClose={onClose}
      onCloseAll={onCloseAll}
      onDismissToday={onDismissToday}
    >
      {moveIns.map((moveIn) => (
        <EntryAlertCard
          key={moveIn.occupancyId}
          title={householdLabel(moveIn)}
          subtitle={`입주예정 ${formatDotDate(moveIn.moveInDate)}`}
        />
      ))}
    </EntryAlertModal>
  );
}
