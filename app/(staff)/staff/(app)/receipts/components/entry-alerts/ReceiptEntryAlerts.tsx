"use client";

import { useState } from "react";
import { useMe } from "@/hooks/reactquery/auth";
import { getKoreaToday } from "@/hooks/reactquery/dashboard";
import {
  useTodayMoveIns,
  useUpcomingLeaseExpiries,
} from "@/hooks/reactquery/entryAlerts";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import { LeaseExpiryAlertModal } from "./LeaseExpiryAlertModal";
import { MoveInAlertModal } from "./MoveInAlertModal";
import { useDailyDismiss } from "./useDailyDismiss";

const MOVE_IN_DISMISS_PREFIX = "home-erp:receipts:move-in-dismissed";
const LEASE_EXPIRY_DISMISS_PREFIX = "home-erp:receipts:lease-expiry-dismissed";
/** "알림 설정 ›" 이동 대상 — 정본 `setup.dc.html#alarm`처럼 셋업 설정의 알림 설정 탭을 연다 */
const ALERT_SETTINGS_HREF = "/staff/setup?tab=notifications";
/** 알림 설정 행이 없을 때의 만료 선행 일수 (알림 설정 탭 기본값과 동일) */
const DEFAULT_LEASE_EXPIRY_DAYS = 7;

/**
 * 수납관리 진입 알림 오케스트레이터.
 * 입주예정 → (닫히면) 임대만료 순서로 하나씩 표시한다. 데이터가 없거나 오늘 해제된 알림은 건너뛴다.
 * 셋업 설정 > 알림 설정(on/off·만료 N일 전)을 트리거 조건으로 따른다. 설정 행이 없으면 둘 다 켜짐.
 */
export function ReceiptEntryAlerts() {
  const [today] = useState(getKoreaToday);
  const { data: me } = useMe();
  // 설정을 읽기 전에는 조회하지 않는다 — 꺼둔 알림이 잠깐 뜨는 일을 막는다.
  const { data: config, isSuccess: configLoaded } = useSetupConfig(me?.orgId);
  const moveInEnabled = configLoaded && config?.notifyMoveIn !== false;
  const expiryEnabled = configLoaded && config?.notifyLeaseExpiry !== false;
  const expiryDays = config?.leaseExpiryDays || DEFAULT_LEASE_EXPIRY_DAYS;
  const { data: moveIns } = useTodayMoveIns(today, moveInEnabled);
  const { data: expiries } = useUpcomingLeaseExpiries(
    today,
    expiryDays,
    expiryEnabled,
  );

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
    moveInEnabled &&
      !moveInClosed &&
      !moveInDismiss.dismissed &&
      moveIns &&
      moveIns.length > 0,
  );
  const showExpiry = Boolean(
    !showMoveIn &&
      expiryEnabled &&
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
