"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import BottomNav from "@/app/(resident)/_components/BottomNav";
import MoveOutSection from "@/app/(resident)/_components/MoveOutSection";
import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";
import { useAsyncAction } from "@/hooks/common";
import { useMoveOutRequest } from "@/hooks/reactquery/residentMoveOut";
import {
  useResidentProfile,
  useSetNotifyPrefs,
} from "@/hooks/reactquery/residentProfile";
import { useWithdrawResident } from "@/hooks/reactquery/residentWithdrawal";
import { formatDate } from "@/lib/format";
import { resetOnboardingSession } from "@/lib/resident/onboardingClient";
import { formatPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

import { residentMeClasses as styles } from "./meClasses";
import { ResidentButton } from "@/app/(resident)/_components/ResidentButton";

function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3C7 3 3 6.2 3 10.1c0 2.5 1.7 4.7 4.2 6l-.9 3.4c-.1.4.3.6.6.4l4-2.6c.4 0 .7.1 1.1.1 5 0 9-3.2 9-7.3S17 3 12 3z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      className={styles.chev}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function ResidentMeWorkspace() {
  const router = useRouter();
  const profileQuery = useResidentProfile();
  const moveOutQuery = useMoveOutRequest();
  const notifyMutation = useSetNotifyPrefs();
  const withdrawResident = useWithdrawResident();
  const [alimtalkWarningOpen, setAlimtalkWarningOpen] = useState(false);
  const [moveOutOpen, setMoveOutOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const logoutAction = useAsyncAction();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const isResidentMeRefreshing = [profileQuery, moveOutQuery]
    .some((query) => query.isFetching && !query.isPending);

  if (profileQuery.isPending) {
    return (
      <ResidentAsyncState
        variant="compact"
        role="status"
        message="내 정보를 불러오고 있어요."
        showSpinner
      />
    );
  }

  if (profileQuery.error) {
    return (
      <ResidentAsyncState
        variant="compact"
        role="alert"
        message={<b>내 정보를 불러오지 못했어요.</b>}
        retryLabel="다시 시도"
        onRetry={() => void profileQuery.refetch()}
      />
    );
  }

  const profile = profileQuery.data;

  if (!profile) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>내 정보</h1>
        </header>
        <ResidentAsyncState
          variant="compact"
          role="status"
          message={<b>연결된 세대 정보를 찾을 수 없어요.</b>}
          retryLabel="다시 확인"
          onRetry={() => void profileQuery.refetch()}
        />
        <BottomNav />
      </div>
    );
  }

  const displayName = profile.kakaoName || profile.tenantName || "사용자";
  const avatarChar = Array.from(displayName.trim())[0] ?? "세";
  const notifyOn = profile.alimtalkOptIn;

  const moveOut = moveOutQuery.data;
  const moveOutSubtitle =
    moveOut?.status === "pending"
      ? `${formatDate(moveOut.desiredDate)} 신청 · 확인 중`
      : moveOut?.status === "confirmed"
        ? `${formatDate(moveOut.desiredDate)} 퇴실 예정`
        : "희망 퇴실일을 알려주세요";

  const confirmLogout = async () => {
    await logoutAction.run(async () => {
      try {
        await createClient().auth.signOut();
      } finally {
        resetOnboardingSession();
        router.replace("/resident/login");
      }
    });
  };

  const confirmWithdraw = async () => {
    setWithdrawError(null);
    try {
      await withdrawResident.mutateAsync();
    } catch (error) {
      setWithdrawError(
        error instanceof Error
          ? error.message
          : "회원 탈퇴를 처리하지 못했어요.",
      );
      return;
    }
    try {
      await createClient().auth.signOut();
    } catch {
      // best-effort sign-out; the account link is already removed
    }
    resetOnboardingSession();
    router.replace("/resident/login");
  };

  return (
    <div className={styles.page}>
      {isResidentMeRefreshing ? (
        <div role="status" aria-label="내 정보 갱신 중" className="fixed right-4 top-4 z-30 rounded-full bg-white px-3 py-2 text-xs font-bold text-t3 shadow-card">갱신 중…</div>
      ) : null}
      <header className={styles.header}>
        <h1 className={styles.title}>내 정보</h1>
        <div className={styles.prof}>
          {profile.profileImageUrl ? (
            <Image
              className={styles.av}
              src={profile.profileImageUrl}
              alt=""
              width={52}
              height={52}
              /* 카카오 CDN은 remotePatterns 밖(외부 호스트) → 최적화 제외 */
              unoptimized
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={styles.av} aria-hidden="true">
              {avatarChar}
            </div>
          )}
          <div className={styles.pi}>
            <div className={styles.pn}>
              <span className={styles.kbadge}>
                <KakaoIcon />
                카카오 간편 로그인
              </span>
            </div>
            <div className={styles.pt}>
              <b>{displayName}</b> <span>{formatPhone(profile.phone)}</span>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.scroll}>
        <h2 className={styles.lbl}>세대 정보</h2>
        <section className={styles.card} aria-label="세대 정보">
          <div className={styles.row}>
            <span className={styles.rowKey}>건물 · 호수</span>
            <span className={styles.rowVal}>
              {profile.buildingName} {profile.unitNo}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowKey}>입주일</span>
            <span className={styles.rowVal}>{formatDate(profile.moveInDate)}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowKey}>관리주체</span>
            <span className={styles.rowVal}>{profile.orgName}</span>
          </div>
          <button
            type="button"
            className={`${styles.row} ${styles.go}`}
            onClick={() => setMoveOutOpen(true)}
          >
            <span className={styles.rowText}>
              <b>퇴실 신청</b>
              <span>{moveOutSubtitle}</span>
            </span>
            <ChevronIcon />
          </button>
        </section>

        <h2 className={styles.lbl}>알림 설정</h2>
        <section className={styles.card} aria-label="알림 설정">
          <div className={styles.row}>
            <span className={styles.rowText}>
              <b>알림톡</b>
              <span>관리비 확정 안내와 서비스 공지를 카카오톡으로 받아요</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={notifyOn}
              aria-label="알림톡"
              disabled={notifyMutation.isPending}
              className={`${styles.sw} ${notifyOn ? styles.on : ""}`}
              onClick={() => {
                if (notifyMutation.isPending) return;
                if (notifyOn) {
                  setAlimtalkWarningOpen(true);
                } else {
                  notifyMutation.mutate({ alimtalk: true, sms: true });
                }
              }}
            />
          </div>
        </section>
        <p className={styles.note}>끄면 관리비가 확정돼도 알려드리지 않아요</p>
        {notifyMutation.error ? (
          <p className={styles.error} role="alert">
            알림 설정을 저장하지 못했어요. 다시 시도해 주세요.
          </p>
        ) : null}

        <h2 className={styles.lbl}>이용 정보</h2>
        <section className={styles.card} aria-label="이용 정보">
          <Link className={`${styles.row} ${styles.go}`} href="/resident/terms">
            <span className={styles.rowText}>
              <b>이용약관</b>
            </span>
            <ChevronIcon />
          </Link>
          <Link
            className={`${styles.row} ${styles.go}`}
            href="/resident/privacy"
          >
            <span className={styles.rowText}>
              <b>개인정보 처리방침</b>
            </span>
            <ChevronIcon />
          </Link>
        </section>

        <div className={styles.foot}>
          <button type="button" onClick={() => setLogoutOpen(true)}>
            로그아웃
          </button>
          <button
            type="button"
            className={styles.del}
            onClick={() => {
              setWithdrawError(null);
              setWithdrawOpen(true);
            }}
          >
            회원탈퇴
          </button>
        </div>
      </main>

      <BottomNav />

      <MoveOutSection
        open={moveOutOpen}
        onClose={() => setMoveOutOpen(false)}
      />

      {alimtalkWarningOpen ? (
        <div
          className={styles.confirm}
          role="dialog"
          aria-modal="true"
          aria-labelledby="alimtalk-warning-title"
          onClick={(event) => {
            if (event.target === event.currentTarget)
              setAlimtalkWarningOpen(false);
          }}
        >
          <div className={styles.confirmBody}>
            <h2 className={styles.confirmTitle} id="alimtalk-warning-title">
              알림톡을 끌까요?
            </h2>
            <p className={styles.confirmDesc}>
              관리비가 확정돼도 <b>금액 · 납부 계좌 · 기한</b>을 알려드릴 수
              없어요.
            </p>
            <div className={styles.confirmActions}>
              <ResidentButton
                variant="secondary"
                size="md"
                type="button"
                className="flex-1 disabled:cursor-wait disabled:opacity-60"
                onClick={() => setAlimtalkWarningOpen(false)}
              >
                닫기
              </ResidentButton>
              <ResidentButton
                variant="danger"
                size="md"
                type="button"
                className="flex-1 disabled:cursor-wait disabled:opacity-60"
                onClick={() => {
                  notifyMutation.mutate({ alimtalk: false, sms: false });
                  setAlimtalkWarningOpen(false);
                }}
              >
                그래도 끄기
              </ResidentButton>
            </div>
          </div>
        </div>
      ) : null}

      {logoutOpen ? (
        <div
          className={styles.confirm}
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setLogoutOpen(false);
          }}
        >
          <div className={styles.confirmBody}>
            <h2 className={styles.confirmTitle} id="logout-title">
              로그아웃할까요?
            </h2>
            <p className={styles.confirmDesc}>
              다시 카카오로 로그인하면 바로 이용할 수 있어요.
            </p>
            <div className={styles.confirmActions}>
              <ResidentButton
                variant="secondary"
                size="md"
                type="button"
                className="flex-1 disabled:cursor-wait disabled:opacity-60"
                onClick={() => setLogoutOpen(false)}
              >
                닫기
              </ResidentButton>
              <ResidentButton
                variant="primary"
                size="md"
                type="button"
                className="flex-1 disabled:cursor-wait disabled:opacity-60"
                disabled={logoutAction.isPending}
                onClick={() => void confirmLogout()}
              >
                {logoutAction.isPending ? "로그아웃 중…" : "로그아웃"}
              </ResidentButton>
            </div>
          </div>
        </div>
      ) : null}

      {withdrawOpen ? (
        <div
          className={styles.confirm}
          role="dialog"
          aria-modal="true"
          aria-labelledby="withdraw-title"
          onClick={(event) => {
            if (event.target === event.currentTarget && !withdrawResident.isPending)
              setWithdrawOpen(false);
          }}
        >
          <div className={styles.confirmBody}>
            <h2 className={styles.confirmTitle} id="withdraw-title">
              정말 탈퇴할까요?
            </h2>
            <p className={styles.confirmDesc}>
              세대 연결과 알림 설정이 모두 삭제돼요. 부과 · 납부 내역은
              관리사무소에 보관됩니다.
            </p>
            {withdrawError ? (
              <p className={styles.confirmError} role="alert">
                {withdrawError}
              </p>
            ) : null}
            <div className={styles.confirmActions}>
              <ResidentButton
                variant="secondary"
                size="md"
                type="button"
                className="flex-1 disabled:cursor-wait disabled:opacity-60"
                onClick={() => setWithdrawOpen(false)}
                disabled={withdrawResident.isPending}
              >
                취소
              </ResidentButton>
              <ResidentButton
                variant="danger"
                size="md"
                type="button"
                className="flex-1 disabled:cursor-wait disabled:opacity-60"
                disabled={withdrawResident.isPending}
                onClick={() => void confirmWithdraw()}
              >
                {withdrawResident.isPending ? "탈퇴 처리 중…" : "탈퇴하기"}
              </ResidentButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
