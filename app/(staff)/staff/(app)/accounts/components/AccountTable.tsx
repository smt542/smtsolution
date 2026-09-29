"use client";
import { DataTable } from "@/components/common";
import { MaskedPhone } from "@/components/common/MaskedPhone";
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
const AC_ROW = "cursor-pointer hover:[&>td]:bg-row-hover-accent";

// 정본은 `table-layout:auto` 라 컬럼 폭이 더미 데이터 길이대로 나뉜다. 그 렌더 비율을
// 실측해 폭으로 선언한다 — 그러지 않으면 앱 데이터 길이에 따라 분배가 달라진다
// (연락처가 빈 계정이면 289px → 142px 로 줄고 그만큼 다른 열이 벌어졌다).
// 비율은 뷰포트 1340과 1920에서 동일하게 측정됐다. 유형 열이 빠지는 현장 탭은
// auto 가 남는 폭을 재분배하므로 세트가 따로 필요하다.
const WIDTHS_OFFICE: Record<string, string> = {
  name: "13.52%", username: "18.54%", password: "14.34%",
  phone: "27.43%", type: "12.64%", status: "13.52%",
};
const WIDTHS_FIELD: Record<string, string> = {
  name: "15.79%", username: "19.65%", password: "16.75%",
  phone: "32.03%", status: "15.79%",
};

interface Props {
  accounts: Account[];
  onRowClick: (a: Account) => void;
  hideType?: boolean;
}

export function AccountTable({ accounts, onRowClick, hideType = false }: Props) {
  const widths = hideType ? WIDTHS_FIELD : WIDTHS_OFFICE;
  const columns = [
    { key: "name", label: "이름" },
    { key: "username", label: "아이디" },
    { key: "password", label: "비밀번호", cellClassName: "num" },
    { key: "phone", label: "연락처", cellClassName: "num" },
    ...(!hideType ? [{ key: "type", label: "유형" }] : []),
    { key: "status", label: "상태" },
  ].map((col) => ({ ...col, width: widths[col.key] }));

  const rows = accounts.map((a) => {
    return {
      name: a.fullName,
      username: a.username,
      password: PASSWORD_MASK,
      phone: a.phone ? (
        <MaskedPhone
          value={a.phone}
          kind="phone"
          alreadyMasked
          reveal={{ targetKind: "profile", targetId: a.userId, field: "phone" }}
        />
      ) : "-",
      ...(hideType ? {} : { type: isMaster(a.role) ? "마스터" : "일반" }),
      status: a.isActive ? "활성화" : "비활성화",
    };
  });

  return (
    <DataTable
      columns={columns}
      rows={rows}
      variant="canon"
      fixedLayout
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
