"use client";

import type { OrganizationStatus } from "@/hooks/reactquery/platform";

const OPTIONS: { value: OrganizationStatus; label: string }[] = [
  { value: "trial", label: "체험" },
  { value: "active", label: "운영 중" },
  { value: "suspended", label: "정지" },
];

interface Props {
  status: OrganizationStatus;
  onChange: (next: OrganizationStatus) => Promise<void> | void;
  isPending: boolean;
}

export function OrgStatusControl({ status, onChange, isPending }: Props) {
  return (
    <select
      aria-label="조직 상태 변경"
      value={status}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value as OrganizationStatus;
        if (next === status) return;
        const message = next === "suspended"
          ? "조직을 정지하면 해당 업체의 사무·현장 관리자와 세입자 앱 접속이 제한됩니다. 계속할까요?"
          : `조직 상태를 '${OPTIONS.find((option) => option.value === next)?.label}'(으)로 변경할까요?`;
        if (!window.confirm(message)) {
          e.currentTarget.value = status;
          return;
        }
        void onChange(next);
      }}
      className="h-8 rounded-[9px] border border-line bg-surface px-2.5 text-[12.5px] font-bold text-t2 outline-none hover:border-blue focus:border-blue focus:ring-[3px] focus:ring-blue-t disabled:opacity-50"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
