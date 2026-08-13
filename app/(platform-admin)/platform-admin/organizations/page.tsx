"use client";

import { useMemo, useState } from "react";
import { EmptyState, SearchBar, Spinner } from "@/components/common";
import { toast } from "sonner";
import { usePlatformOrganizations, useUpdateOrganizationStatus, type OrganizationStatus } from "@/hooks/reactquery/platform";
import {
  DataScopeNotice,
  PageHeader,
  QueryError,
  StatusBadge,
} from "../../_components/PageElements";
import { OrgStatusControl } from "./components/OrgStatusControl";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export default function PlatformOrganizationsPage() {
  const [search, setSearch] = useState("");
  const { data: organizations = [], isPending, isError, refetch } = usePlatformOrganizations();
  const updateStatus = useUpdateOrganizationStatus();
  const handleStatus = async (id: number, next: OrganizationStatus) => {
    try {
      await updateStatus.mutateAsync({ id, status: next });
      toast.success("조직 상태를 변경했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "상태 변경에 실패했습니다.");
    }
  };
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("ko-KR");
    if (!keyword) return organizations;
    return organizations.filter((organization) =>
      `${organization.name} ${organization.slug ?? ""}`.toLocaleLowerCase("ko-KR").includes(keyword),
    );
  }, [organizations, search]);

  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="ORGANIZATIONS"
        title="조직 관리"
        description="입점 조직의 기본 정보와 현재 연결된 운영 규모를 조회합니다."
      />

      <div className="mt-5"><DataScopeNotice /></div>

      <section className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-extrabold text-t1">조직 목록</h3>
            <p className="mt-1 text-xs text-t3">총 {organizations.length.toLocaleString("ko-KR")}개</p>
          </div>
          <div className="w-full sm:w-80">
            <SearchBar value={search} onChange={setSearch} placeholder="조직명·회사코드 검색" />
          </div>
        </div>

        {isPending ? (
          <div className="py-16"><Spinner /></div>
        ) : isError ? (
          <div className="p-4"><QueryError onRetry={() => void refetch()} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState message={search ? "검색 결과가 없습니다" : "조회 가능한 조직이 없습니다"} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg/70 text-left text-xs font-bold text-t3">
                  <th className="px-5 py-3">조직</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3 text-right">건물</th>
                  <th className="px-4 py-3 text-right">계정</th>
                  <th className="px-4 py-3 text-right">포인트 잔액</th>
                  <th className="px-5 py-3">등록일</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((organization) => (
                  <tr key={organization.id} className="border-b border-line last:border-0 hover:bg-bg/50">
                    <td className="px-5 py-4">
                      <div className="font-bold text-t1">{organization.name}</div>
                      <div className="mt-1 text-xs text-t3">{organization.slug ?? "회사코드 미설정"}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={organization.status} />
                        <OrgStatusControl
                          status={organization.status}
                          isPending={updateStatus.isPending}
                          onChange={(next) => handleStatus(organization.id, next)}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-t1 num">{organization.buildingCount.toLocaleString("ko-KR")}</td>
                    <td className="px-4 py-4 text-right font-bold text-t1 num">{organization.accountCount.toLocaleString("ko-KR")}</td>
                    <td className="px-4 py-4 text-right font-extrabold text-t1 num">{organization.pointBalance.toLocaleString("ko-KR")} P</td>
                    <td className="px-5 py-4 text-t2 num">{dateFormatter.format(new Date(organization.createdAt))}</td>
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
