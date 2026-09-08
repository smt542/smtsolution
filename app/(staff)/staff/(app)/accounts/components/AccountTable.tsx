"use client";
import { DataTable, Button } from "@/components/common";
import { isMaster } from "@/lib/auth/permissions";
import type { Account } from "@/hooks/reactquery/accounts";

const PASSWORD_MASK = "●●●●";

interface Props {
  accounts: Account[];
  onRowClick: (a: Account) => void;
  onToggleActive: (a: Account) => void;
}

export function AccountTable({ accounts, onRowClick, onToggleActive }: Props) {
  const columns = [
    { key: "name", label: "이름" },
    { key: "username", label: "아이디" },
    { key: "password", label: "비밀번호" },
    { key: "phone", label: "연락처" },
    { key: "type", label: "유형" },
    { key: "status", label: "상태" },
  ];

  const rows = accounts.map((a) => ({
    name: <span>{a.fullName}</span>,
    username: a.username,
    password: PASSWORD_MASK,
    phone: a.phone ?? "-",
    type: isMaster(a.role) ? "마스터" : "일반",
    status: (
      <Button
        type="button"
        variant="ghost"
        aria-label={`${a.fullName} ${a.isActive ? "비활성화" : "활성화"}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleActive(a);
        }}
        className={a.isActive ? "text-brand" : "text-t4"}
      >
        {a.isActive ? "활성화" : "비활성화"}
      </Button>
    ),
  }));

  return (
    <DataTable
      columns={columns}
      rows={rows}
      onRowClick={(r) => {
        const idx = rows.indexOf(r as (typeof rows)[number]);
        if (idx >= 0) onRowClick(accounts[idx]);
      }}
    />
  );
}
