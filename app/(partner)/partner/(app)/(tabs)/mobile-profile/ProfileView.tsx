"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useAsyncAction } from "@/hooks/common";
import { useLogout } from "@/hooks/reactquery/auth";
import { usePartnerMyPin } from "@/hooks/reactquery/partnerProfile";

import { profileClasses as styles } from "./profileClasses";
import { PartnerButton } from "../../../../_components/PartnerButton";
import { PartnerConfirmDialog } from "../../../../_components/PartnerConfirmDialog";

export function ProfileView({
  fullName,
  username,
  phone,
}: {
  fullName: string;
  username: string;
  phone: string;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pinShown, setPinShown] = useState(false);
  const myPin = usePartnerMyPin(pinShown);
  const logoutAction = useAsyncAction();
  const logoutMutation = useLogout();

  const logout = async () => {
    await logoutAction.run(async () => {
      try {
        // 공용 useLogout: signOut(local) 후 React Query 캐시를 비운다.
        await logoutMutation.mutateAsync();
      } catch {
        /* signOut 실패해도 로그인 화면으로 이동 */
      }
      router.replace("/partner/mobile-login");
    });
  };

  const initial = fullName.trim().charAt(0) || "·";
  // 정본 #pfPw: 끄면 ••••, 켜면 본인 비밀번호. 저장된 값이 없거나 불러오지 못하면 '-'.
  const pinText = !pinShown
    ? "••••"
    : myPin.isSuccess
      ? (myPin.data ?? "-")
      : myPin.isError
        ? "-"
        : "••••";

  return (
    <div className={styles.root}>
      <div className={styles.header}>프로필</div>
      <div className={styles.scroll}>
        <div className={styles.card}>
          <div className={styles.avatar}>{initial}</div>
          <div>
            <div className={styles.name}>{fullName || "이름 없음"}</div>
            {phone && <div className={styles.phone}>{phone}</div>}
          </div>
          <div className={styles.rows}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>아이디</span>
              <b className={styles.rowValue}>{username || "-"}</b>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>비밀번호</span>
              <span className={styles.pw}>
                <b className={styles.rowValue}>{pinText}</b>
                <button
                  type="button"
                  className={`${styles.eye} ${pinShown ? styles.eyeOn : styles.eyeOff}`}
                  onClick={() => setPinShown((v) => !v)}
                  aria-label={pinShown ? "비밀번호 숨기기" : "비밀번호 보기"}
                  aria-pressed={pinShown}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true">
                    <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
                    <circle cx="12" cy="12" r="2.8" />
                  </svg>
                </button>
              </span>
            </div>
          </div>
        </div>

        <PartnerButton variant="ghost" type="button" className="mt-4 w-full" onClick={() => setConfirm(true)}>
          로그아웃
        </PartnerButton>
      </div>

      {confirm && (
        <PartnerConfirmDialog
          compact
          title="로그아웃할까요?"
          description="다시 이용하려면 로그인이 필요해요."
          cancelLabel="취소"
          confirmLabel={logoutAction.isPending ? "로그아웃 중…" : "로그아웃"}
          confirmVariant="danger"
          onCancel={() => setConfirm(false)}
          onConfirm={logout}
          confirmDisabled={logoutAction.isPending}
        />
      )}
    </div>
  );
}
