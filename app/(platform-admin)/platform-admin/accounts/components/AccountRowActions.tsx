"use client";

import type { PlatformAccount } from "@/hooks/reactquery/platform";

interface Props {
  account: PlatformAccount;
  onChangeRole: () => void;
  onToggleActive: () => void;
  onResetPassword: () => void;
  isPending: boolean;
}

const buttonClass =
  "rounded-lg border border-line px-2.5 py-1 text-xs font-bold hover:bg-bg/60 disabled:opacity-50";

export function AccountRowActions({
  account,
  onChangeRole,
  onToggleActive,
  onResetPassword,
  isPending,
}: Props) {
  const accountName = account.fullName ?? account.username ?? account.userId;

  return (
    <div className="flex flex-col items-end gap-1.5">
      {account.role === "platform_admin" && (
        <span className="text-[10px] font-semibold text-danger">권한 변경 시 플랫폼 관리자 강등 주의</span>
      )}
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onChangeRole}
          disabled={isPending}
          className={`${buttonClass} text-t2`}
        >
          권한 변경
        </button>
        <button
          type="button"
          onClick={() => {
            const action = account.isActive ? "비활성화" : "활성화";
            if (window.confirm(`'${accountName}' 계정을 ${action}할까요?`)) onToggleActive();
          }}
          disabled={isPending}
          className={`${buttonClass} ${account.isActive ? "text-danger" : "text-blue"}`}
        >
          {account.isActive ? "비활성" : "활성"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`'${accountName}' 계정의 비밀번호를 초기화할까요?`)) {
              onResetPassword();
            }
          }}
          disabled={isPending}
          className={`${buttonClass} text-t2`}
        >
          비번 초기화
        </button>
      </div>
    </div>
  );
}
