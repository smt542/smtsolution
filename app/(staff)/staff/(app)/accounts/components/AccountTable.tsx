"use client";
import { DataTable } from "@/components/common";
import { isMaster } from "@/lib/auth/permissions";
import type { Account } from "@/hooks/reactquery/accounts";

const PASSWORD_MASK = "●●●●";

// 정본 `#acTbl` 오버라이드 층. td 규칙이 `!important` 라서 마크업의 인라인
// `font-weight:700`(이름)과 `.muted` 색(아이디·비밀번호·연락처)까지 덮어쓴다 —
// 즉 본문 셀은 전부 13px / 500 / --t1 로 균일하다. 열별 굵기·색을 주면 어긋난다.
//   #acTbl tbody td { font-size:13px!important; font-weight:500!important; color:var(--t1)!important }
//   #acTbl th, #acTbl tbody td { padding-left:12px; padding-right:12px }
//   #acTbl th:first-child, #acTbl tbody td:first-child { padding-left:16px }
//   #acTbl th:last-child,  #acTbl tbody td:last-child  { padding-right:16px }
//   #acTbl tbody tr:hover>td { background:var(--blue-t2) }
const AC_TH = "px-[12px] text-[12px] first:pl-[16px] last:pr-[16px]";
const AC_TD = "px-[12px] text-[13px] font-medium text-t1 first:pl-[16px] last:pr-[16px]";
const AC_ROW = "cursor-pointer hover:[&>td]:bg-blue-t2";

interface Props {
  accounts: Account[];
  onRowClick: (a: Account) => void;
  hideType?: boolean;
}

export function AccountTable({ accounts, onRowClick, hideType = false }: Props) {
  const columns = [
    { key: "name", label: "이름" },
    { key: "username", label: "아이디" },
    { key: "password", label: "비밀번호", cellClassName: "num" },
    { key: "phone", label: "연락처", cellClassName: "num" },
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
      thClassName={AC_TH}
      tdClassName={AC_TD}
      rowClassName={AC_ROW}
      onRowClick={(r) => {
        const idx = rows.indexOf(r as (typeof rows)[number]);
        if (idx >= 0) onRowClick(accounts[idx]);
      }}
    />
  );
}
