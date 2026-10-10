"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useAsyncAction } from "@/hooks/common";
import { useLogout } from "@/hooks/reactquery/auth";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { PasswordChangeForm } from "@/components/auth/PasswordChangeForm";

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
  const [changingPassword, setChangingPassword] = useState(false);
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
              {/* 비밀번호 원문은 저장하지 않으므로 보여주지 않는다 — 변경만 가능 */}
              <span className={styles.pw}>
                <b className={styles.rowValue}>••••••</b>
                <button
                  type="button"
                  className="text-[13px] font-bold text-blue"
                  onClick={() => setChangingPassword((v) => !v)}
                  aria-expanded={changingPassword}
                >
                  {changingPassword ? "닫기" : "변경"}
                </button>
              </span>
            </div>
          </div>
        </div>

        {changingPassword && (
          <div className="mt-4 rounded-[20px] border border-line px-[18px] py-6 text-left">
            <PasswordChangeForm
              submitLabel="비밀번호 변경"
              onSuccess={() => {
                toast.success("비밀번호를 변경했어요");
                setChangingPassword(false);
              }}
            />
          </div>
        )}

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
