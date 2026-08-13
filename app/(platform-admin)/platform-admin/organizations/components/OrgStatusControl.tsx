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
        if (next !== status) void onChange(next);
      }}
      className="rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-bold text-t1 disabled:opacity-50"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
