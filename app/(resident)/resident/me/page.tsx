"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import BottomNav from "@/app/(resident)/_components/BottomNav";
import MoveOutSection from "@/app/(resident)/_components/MoveOutSection";
import {
  useResidentProfile,
  useSetNotifyPrefs,
} from "@/hooks/reactquery/residentProfile";
import { useWithdrawResident } from "@/hooks/reactquery/residentWithdrawal";
import { formatDate } from "@/lib/format";
import { resetOnboardingSession } from "@/lib/resident/onboardingClient";
import { useResidentGuard } from "@/lib/resident/useResidentGuard";
import { createClient } from "@/lib/supabase/client";

import styles from "./me.module.css";

export default function ResidentMePage() {
  const router = useRouter();
  const guard = useResidentGuard();
  const profileQuery = useResidentProfile();
  const notifyMutation = useSetNotifyPrefs();
  const withdrawResident = useWithdrawResident();
  const [alimtalkWarningOpen, setAlimtalkWarningOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  if (guard.loading || profileQuery.isPending) {
    return (
      <div className={styles.center} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        내 정보를 불러오고 있어요.
      </div>
    );
  }

  if (guard.error || profileQuery.error) {
    return (
      <div className={styles.center} role="alert">
        <b>내 정보를 불러오지 못했어요.</b>
        <button
          type="button"
          onClick={() => {
            void guard.retry();
            void profileQuery.refetch();
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!guard.link) return null;

  const profile = profileQuery.data;

  if (!profile) {
    return (
      <div className={styles.page}>
        <header className={styles.header}><h1>내 정보</h1></header>
        <div className={styles.center} role="status">
          <b>연결된 세대 정보를 찾을 수 없어요.</b>
          <button type="button" onClick={() => void profileQuery.refetch()}>
            다시 확인
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      await createClient().auth.signOut();
    } finally {
      resetOnboardingSession();
      router.replace("/resident/login");
    }
  };

  const confirmWithdraw = async () => {
    setWithdrawError(null);
    setWithdrawing(true);
    try {
      await withdrawResident.mutateAsync();
    } catch (error) {
      setWithdrawing(false);
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
      <header className={styles.header}>
        <p>{profile.buildingName} {profile.unitNo}</p>
        <h1>내 정보</h1>
      </header>

      <main className={styles.scroll}>
        <section className={styles.card} aria-labelledby="profile-title">
          <h2 id="profile-title">프로필</h2>
          <dl>
            <div><dt>이름</dt><dd>{profile.tenantName}</dd></div>
            <div><dt>전화</dt><dd>{profile.phone}</dd></div>
            <div><dt>로그인 방식</dt><dd>카카오 간편로그인</dd></div>
          </dl>
        </section>

        <section className={styles.card} aria-labelledby="household-title">
          <div className={styles.sectionTitle}>
            <h2 id="household-title">세대</h2>
            {profile.transferMethod === "auto_transfer" ? (
              <span className={styles.marker}>자동이체 세대</span>
            ) : null}
          </div>
          <dl>
            <div><dt>건물/호실</dt><dd>{profile.buildingName} {profile.unitNo}</dd></div>
            <div><dt>입주일</dt><dd>{formatDate(profile.moveInDate)}</dd></div>
            <div><dt>관리업체</dt><dd>{profile.orgName}</dd></div>
          </dl>
        </section>

        <section className={styles.card} aria-labelledby="notification-title">
          <h2 id="notification-title">알림 설정</h2>
          <div className={styles.toggleRow}>
            <div>
              <b>카카오 알림톡</b>
              <span>관리비 확정 및 주요 안내</span>
            </div>
            <label className={styles.switch}>
              <span className={styles.srOnly}>카카오 알림톡</span>
              <input
                type="checkbox"
                role="switch"
                checked={profile.alimtalkOptIn}
                disabled={notifyMutation.isPending}
                onChange={(event) => {
                  if (event.target.checked) {
                    notifyMutation.mutate({ alimtalk: true });
                  } else {
                    setAlimtalkWarningOpen(true);
                  }
                }}
              />
              <span aria-hidden="true" />
            </label>
          </div>
          <div className={styles.toggleRow}>
            <div>
              <b>문자</b>
              <span>알림톡 미수신 시 문자 안내</span>
            </div>
            <label className={styles.switch}>
              <span className={styles.srOnly}>문자</span>
              <input
                type="checkbox"
                role="switch"
                checked={profile.smsOptIn}
                disabled={notifyMutation.isPending}
                onChange={(event) =>
                  notifyMutation.mutate({ sms: event.target.checked })
                }
              />
              <span aria-hidden="true" />
            </label>
          </div>
          {notifyMutation.error ? (
            <p className={styles.error} role="alert">
              알림 설정을 저장하지 못했어요. 다시 시도해 주세요.
            </p>
          ) : null}
        </section>

        <MoveOutSection />

        <nav className={styles.links} aria-label="정책 및 계정">
          <Link href="/resident/terms"><span>이용약관</span><b aria-hidden="true">›</b></Link>
          <Link href="/resident/privacy"><span>개인정보 처리방침</span><b aria-hidden="true">›</b></Link>
          <button type="button" onClick={() => setLogoutOpen(true)}>
            <span>로그아웃</span><b aria-hidden="true">›</b>
          </button>
          <button
            type="button"
            className={styles.withdrawal}
            onClick={() => {
              setWithdrawError(null);
              setWithdrawOpen(true);
            }}
          >
            회원 탈퇴
          </button>
        </nav>
      </main>

      <BottomNav />

      {alimtalkWarningOpen ? (
        <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="alimtalk-warning-title">
          <div className={styles.modalBody}>
            <h2 id="alimtalk-warning-title">카카오 알림톡을 끌까요?</h2>
            <p>관리비 확정 안내를 못 받을 수 있어요.</p>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setAlimtalkWarningOpen(false)}>유지하기</button>
              <button
                type="button"
                className={styles.danger}
                onClick={() => {
                  notifyMutation.mutate({ alimtalk: false });
                  setAlimtalkWarningOpen(false);
                }}
              >
                끄기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {logoutOpen ? (
        <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="logout-title">
          <div className={styles.modalBody}>
            <h2 id="logout-title">로그아웃할까요?</h2>
            <p>현재 계정에서 로그아웃하고 로그인 화면으로 이동해요.</p>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setLogoutOpen(false)}>취소</button>
              <button
                type="button"
                className={styles.danger}
                disabled={loggingOut}
                onClick={() => void confirmLogout()}
              >
                {loggingOut ? "로그아웃 중..." : "로그아웃"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {withdrawOpen ? (
        <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="withdraw-title">
          <div className={styles.modalBody}>
            <h2 id="withdraw-title">회원 탈퇴할까요?</h2>
            <p>
              연결된 세대 정보와 카카오 로그인 연결이 삭제돼요. 관리비·공지 등
              세입자 서비스를 더 이상 이용할 수 없어요.
            </p>
            {withdrawError ? (
              <p className={styles.error} role="alert">
                {withdrawError}
              </p>
            ) : null}
            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => setWithdrawOpen(false)}
                disabled={withdrawing}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.danger}
                disabled={withdrawing}
                onClick={() => void confirmWithdraw()}
              >
                {withdrawing ? "처리 중..." : "회원 탈퇴"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
