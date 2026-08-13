"use client";

import { useMemo, useState } from "react";
import { EmptyState, SearchBar, Spinner } from "@/components/common";
import { usePlatformAccounts, type PlatformAccount } from "@/hooks/reactquery/platform";
import { DataScopeNotice, PageHeader, QueryError } from "../../_components/PageElements";

const ROLE_LABELS: Record<PlatformAccount["role"], string> = {
  platform_admin: "플랫폼 관리자",
  org_owner: "조직 소유자",
  manager: "관리자",
  staff: "직원",
  field: "현장 직원",
  tenant: "입주자",
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export default function PlatformAccountsPage() {
  const [search, setSearch] = useState("");
  const { data: accounts = [], isPending, isError, refetch } = usePlatformAccounts();
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("ko-KR");
    if (!keyword) return accounts;
    return accounts.filter((account) =>
      `${account.organizationName} ${account.fullName ?? ""} ${account.username ?? ""}`
        .toLocaleLowerCase("ko-KR")
        .includes(keyword),
    );
  }, [accounts, search]);

  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="ACCOUNTS"
        title="계정 관리"
        description="조직 소속과 프로필 정보를 결합해 플랫폼 계정 상태를 조회합니다. 계정 변경은 기존 조직별 직원 관리에서 수행합니다."
      />

      <div className="mt-5"><DataScopeNotice /></div>

      <section className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-extrabold text-t1">소속 계정 목록</h3>
            <p className="mt-1 text-xs text-t3">총 {accounts.length.toLocaleString("ko-KR")}개</p>
          </div>
          <div className="w-full sm:w-80">
            <SearchBar value={search} onChange={setSearch} placeholder="조직·이름·아이디 검색" />
          </div>
        </div>

        {isPending ? (
          <div className="py-16"><Spinner /></div>
        ) : isError ? (
          <div className="p-4"><QueryError onRetry={() => void refetch()} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState message={search ? "검색 결과가 없습니다" : "조회 가능한 계정이 없습니다"} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg/70 text-left text-xs font-bold text-t3">
                  <th className="px-5 py-3">계정</th>
                  <th className="px-4 py-3">조직</th>
                  <th className="px-4 py-3">권한</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-5 py-3">소속일</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((account) => (
                  <tr key={`${account.orgId}:${account.userId}`} className="border-b border-line last:border-0 hover:bg-bg/50">
                    <td className="px-5 py-4">
                      <div className="font-bold text-t1">{account.fullName ?? "프로필 없음"}</div>
                      <div className="mt-1 text-xs text-t3">{account.username ?? account.userId}</div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-t2">{account.organizationName}</td>
                    <td className="px-4 py-4 text-t2">{ROLE_LABELS[account.role]}</td>
                    <td className="px-4 py-4"><AccountStatus active={account.isActive} /></td>
                    <td className="px-5 py-4 text-t2 num">{dateFormatter.format(new Date(account.createdAt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AccountStatus({ active }: { active: boolean | null }) {
  if (active === null) {
    return <span className="rounded-full bg-bg px-2.5 py-1 text-[11px] font-bold text-t3">확인 불가</span>;
  }
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${active ? "bg-green-t text-green" : "bg-red-t text-red"}`}>
      {active ? "활성" : "비활성"}
    </span>
  );
}
