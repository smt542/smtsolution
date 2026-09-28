"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { useAsyncAction } from "@/hooks/common";

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
  const logoutAction = useAsyncAction();

  const logout = async () => {
    await logoutAction.run(async () => {
      try {
        await createClient().auth.signOut({ scope: "local" });
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
