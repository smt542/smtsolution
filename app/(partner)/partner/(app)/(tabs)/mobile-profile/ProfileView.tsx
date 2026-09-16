"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { useAsyncAction } from "@/hooks/common";

import { profileClasses as styles } from "./profileClasses";

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
  const logoutAction = useAsyncAction();

  const logout = async () => {
    await logoutAction.run(async () => {
      try {
        await createClient().auth.signOut();
      } catch {
        /* signOut 실패해도 로그인 화면으로 이동 */
      }
      router.replace("/partner/mobile-login");
    });
  };

  const initial = fullName.trim().charAt(0) || "·";

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
              <b className={styles.rowValue}>••••••</b>
            </div>
          </div>
        </div>

        <button type="button" className={styles.logout} onClick={() => setConfirm(true)}>
          로그아웃
        </button>
      </div>

      {confirm && (
        <div
          className={styles.scrim}
          onClick={(e) => e.target === e.currentTarget && setConfirm(false)}
        >
          <div className={styles.dialog}>
            <div className={styles.dTitle}>로그아웃할까요?</div>
            <div className={styles.dDesc}>다시 이용하려면 로그인이 필요해요.</div>
            <div className={styles.dActions}>
              <button
                type="button"
                className={`${styles.dBtn} ${styles.dCancel}`}
                onClick={() => setConfirm(false)}
              >
                취소
              </button>
              <button
                type="button"
                className={`${styles.dBtn} ${styles.dDanger}`}
                onClick={logout}
                disabled={logoutAction.isPending}
              >
                {logoutAction.isPending ? "로그아웃 중…" : "로그아웃"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
