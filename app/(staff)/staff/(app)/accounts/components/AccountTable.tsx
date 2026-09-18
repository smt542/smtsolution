"use client";
import { DataTable } from "@/components/common";
import { isMaster } from "@/lib/auth/permissions";
import type { Account } from "@/hooks/reactquery/accounts";

const PASSWORD_MASK = "●●●●";

interface Props {
  accounts: Account[];
  onRowClick: (a: Account) => void;
  hideType?: boolean;
}

export function AccountTable({ accounts, onRowClick, hideType = false }: Props) {
  const columns = [
    { key: "name", label: "이름", cellClassName: "font-bold" },
    { key: "username", label: "아이디", cellClassName: "text-t3" },
    { key: "password", label: "비밀번호", cellClassName: "text-t3 num" },
    { key: "phone", label: "연락처", cellClassName: "text-t3 num" },
    ...(!hideType ? [{ key: "type", label: "유형" }] : []),
    { key: "status", label: "상태" },
  ];

  const rows = accounts.map((a) => {
    return {
      name: a.fullName,
      username: a.username,
      password: PASSWORD_MASK,
      phone: a.phone ?? "-",
      ...(hideType ? {} : { type: isMaster(a.role) ? "마스터" : "일반" }),
      status: a.isActive ? "활성화" : "비활성화",
    };
  });

  return (
    <DataTable
      columns={columns}
      rows={rows}
      variant="canon"
      onRowClick={(r) => {
        const idx = rows.indexOf(r as (typeof rows)[number]);
        if (idx >= 0) onRowClick(accounts[idx]);
      }}
    />
  );
}
