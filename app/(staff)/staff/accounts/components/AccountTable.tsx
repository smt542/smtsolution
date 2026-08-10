"use client";
import { DataTable, Button } from "@/components/common";
import { isMaster } from "@/lib/auth/permissions";
import type { Account } from "@/hooks/reactquery/accounts";
import type { StaffType } from "@/hooks/reactquery/auth";

const TYPE_LABEL: Record<StaffType, string> = {
  manager_staff: "직원",
  field_staff: "현장직원",
  support_staff: "스태프",
  tenant: "입주자",
};

function typeLabel(a: Account): string {
  if (a.staffType === "manager_staff" && isMaster(a.role)) return "관리자";
  return TYPE_LABEL[a.staffType];
}

interface Props {
  accounts: Account[];
  onRowClick: (a: Account) => void;
  onToggleActive: (a: Account) => void;
}

export function AccountTable({ accounts, onRowClick, onToggleActive }: Props) {
  const columns = [
    { key: "name", label: "이름" },
    { key: "type", label: "유형" },
    { key: "username", label: "아이디" },
    { key: "phone", label: "연락처" },
    { key: "grade", label: "권한등급" },
    { key: "roles", label: "담당역할" },
    { key: "status", label: "상태" },
  ];

  const rows = accounts.map((a) => ({
    name: <span>{a.fullName}</span>,
    type: typeLabel(a),
    username: a.username,
    phone: a.phone ?? "-",
    grade: isMaster(a.role) ? "마스터" : "일반",
    roles: a.roleLabels.length ? a.roleLabels.join(", ") : "-",
    status: (
      <Button
        type="button"
        variant="ghost"
        aria-label={`${a.fullName} ${a.isActive ? "비활성" : "활성"}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleActive(a);
        }}
        className={a.isActive ? "text-brand" : "text-t4"}
      >
        {a.isActive ? "활성" : "비활성"}
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
