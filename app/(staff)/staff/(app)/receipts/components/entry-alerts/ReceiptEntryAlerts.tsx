"use client";

import { useState } from "react";
import { useMe } from "@/hooks/reactquery/auth";
import { getKoreaToday } from "@/hooks/reactquery/dashboard";
import {
  useTodayMoveIns,
  useUpcomingLeaseExpiries,
} from "@/hooks/reactquery/entryAlerts";
import { LeaseExpiryAlertModal } from "./LeaseExpiryAlertModal";
import { MoveInAlertModal } from "./MoveInAlertModal";
import { useDailyDismiss } from "./useDailyDismiss";

const MOVE_IN_DISMISS_PREFIX = "home-erp:receipts:move-in-dismissed";
const LEASE_EXPIRY_DISMISS_PREFIX = "home-erp:receipts:lease-expiry-dismissed";
/** "알림 설정 ›" 이동 대상 — 정본 `setup.dc.html#alarm`처럼 셋업 설정의 알림 설정 탭을 연다 */
const ALERT_SETTINGS_HREF = "/staff/setup?tab=notifications";

/**
 * 수납관리 진입 알림 오케스트레이터.
 * 입주예정 → (닫히면) 임대만료 순서로 하나씩 표시한다. 데이터가 없거나 오늘 해제된 알림은 건너뛴다.
 */
export function ReceiptEntryAlerts() {
  const [today] = useState(getKoreaToday);
  const { data: me } = useMe();
  const { data: moveIns } = useTodayMoveIns(today);
  const { data: expiries } = useUpcomingLeaseExpiries(today);

  const [moveInClosed, setMoveInClosed] = useState(false);
  const [expiryClosed, setExpiryClosed] = useState(false);

  const moveInKey = me
    ? `${MOVE_IN_DISMISS_PREFIX}:${me.orgId}:${me.username}`
    : null;
  const expiryKey = me
    ? `${LEASE_EXPIRY_DISMISS_PREFIX}:${me.orgId}:${me.username}`
    : null;
  const moveInDismiss = useDailyDismiss(moveInKey, today);
  const expiryDismiss = useDailyDismiss(expiryKey, today);

  const showMoveIn = Boolean(
    !moveInClosed && !moveInDismiss.dismissed && moveIns && moveIns.length > 0,
  );
  const showExpiry = Boolean(
    !showMoveIn &&
      !expiryClosed &&
      !expiryDismiss.dismissed &&
      expiries &&
      expiries.length > 0,
  );

  // 정본 upAlerts: X는 남은 알림까지 닫고(upHide), [오늘 그만보기]는 오늘 알림 전부를 숨긴다(키 하나).
  const closeAll = () => {
    setMoveInClosed(true);
    setExpiryClosed(true);
  };
  const dismissAllToday = () => {
    moveInDismiss.dismiss();
    expiryDismiss.dismiss();
    closeAll();
  };

  if (showMoveIn && moveIns) {
    return (
      <MoveInAlertModal
        moveIns={moveIns}
        actionHref={ALERT_SETTINGS_HREF}
        onClose={() => setMoveInClosed(true)}
        onCloseAll={closeAll}
        onDismissToday={dismissAllToday}
      />
    );
  }

  if (showExpiry && expiries) {
    return (
      <LeaseExpiryAlertModal
        expiries={expiries}
        actionHref={ALERT_SETTINGS_HREF}
        onClose={() => setExpiryClosed(true)}
        onCloseAll={closeAll}
        onDismissToday={dismissAllToday}
      />
    );
  }

  return null;
}
