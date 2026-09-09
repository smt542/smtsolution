"use client";

import { useConfirm } from "@/components/common/ConfirmProvider";
import type { PlatformAccount } from "@/hooks/reactquery/platform";

interface Props {
  account: PlatformAccount;
  onEditDetails: () => void;
  onChangeRole: () => void;
  onToggleActive: () => void;
  onResetPassword: () => void;
  isPending: boolean;
}

const buttonClass =
  "inline-flex h-8 items-center rounded-[9px] px-3 text-[12.5px] font-bold text-t2 hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent";

export function AccountRowActions({
  account,
  onEditDetails,
  onChangeRole,
  onToggleActive,
  onResetPassword,
  isPending,
}: Props) {
  const confirm = useConfirm();
  const accountName = account.fullName ?? account.username ?? account.userId;

  return (
    <div className="flex flex-col items-end gap-1.5">
      {account.role === "platform_admin" && (
        <span className="text-[10px] font-semibold text-red">권한 변경 시 플랫폼 관리자 강등 주의</span>
      )}
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onEditDetails}
          disabled={isPending}
          className={buttonClass}
        >
          정보 편집
        </button>
        <button
          type="button"
          onClick={onChangeRole}
          disabled={isPending}
          className={buttonClass}
        >
          권한 변경
        </button>
        <button
          type="button"
          onClick={async () => {
            const action = account.isActive ? "비활성화" : "활성화";
            const ok = await confirm({ title: action, description: `'${accountName}' 계정을 ${action}할까요?`, confirmLabel: action });
            if (ok) onToggleActive();
          }}
          disabled={isPending}
          className={buttonClass}
        >
          {account.isActive ? "비활성" : "활성"}
        </button>
        <button
          type="button"
          onClick={async () => {
            const ok = await confirm({ title: "비밀번호 초기화", description: `'${accountName}' 계정의 비밀번호를 초기화할까요?`, confirmLabel: "초기화" });
            if (ok) onResetPassword();
          }}
          disabled={isPending}
          className={buttonClass}
        >
          비번 초기화
        </button>
      </div>
    </div>
  );
}
