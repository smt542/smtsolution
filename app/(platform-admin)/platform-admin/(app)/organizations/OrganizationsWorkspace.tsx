"use client";

import dynamic from "next/dynamic";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Button, EmptyState, Spinner } from "@/components/common";
import {
  listPlatformOrganizations,
  platformKeys,
  usePlatformOrganizationContractKpis,
  type PlatformOrganization,
  type PlatformOrganizationQuery,
  type PlatformOrganizationStatusFilter,
} from "@/hooks/reactquery/platform";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/common";
import { formatNumber } from "@/lib/format";
import { useFitPageSize } from "../../../_components/useFitPageSize";
import {
  PlatformPagination,
  QueryError,
} from "../../../_components/PageElements";
import { PlatformPageContainer } from "../../../_components/PlatformPageContainer";
import { PlatformTopBarActions } from "../../../_components/PlatformShell";

const OrgFormModal = dynamic(() =>
  import("./components/OrgFormModal").then((module) => module.OrgFormModal),
);

const STATUS_FILTERS: Array<{
  id: "all" | PlatformOrganizationStatusFilter;
  label: string;
}> = [
  { id: "all", label: "전체" },
  { id: "operating", label: "운영" },
  { id: "suspended", label: "정지" },
  { id: "terminated", label: "해지" },
];

function formatContractDate(value: string | null): string {
  return value ? value.slice(0, 10).replaceAll("-", ".") : "-";
}

function TenantStatusBadge({ organization }: { organization: PlatformOrganization }) {
  const style = organization.deletedAt
    ? "bg-bg text-t3"
    : organization.status === "suspended"
      ? "bg-red-t text-red"
      : organization.status === "trial"
        ? "bg-amber-t text-amber"
        : "bg-blue-t text-blue-d";
  const label = organization.deletedAt
    ? "해지"
    : organization.status === "suspended"
      ? "정지"
      : organization.status === "trial"
        ? "체험"
        : "운영";

  return (
    <span className={["inline-flex items-center gap-1 rounded-[7px] px-[9px] py-[3px] text-xs font-bold leading-[1.4]", style].join(" ")}>
      {label}
    </span>
  );
}

export default function OrganizationsWorkspace() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PlatformOrganizationStatusFilter>("all");
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<PlatformOrganization | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  // 표(thead)는 늘 그려 두므로 훅이 처음부터 표를 관찰한다 — 행이 들어오거나 바뀌면 표 높이가 변해 다시 잰다.
  const pageSize = useFitPageSize(scrollerRef, { fallback: 10 });
  const page = pagination.pageSize === pageSize ? pagination.page : 1;
  const query = useMemo<PlatformOrganizationQuery>(() => ({
    includeDeleted: true,
    status: statusFilter === "all" ? undefined : statusFilter,
    search: debouncedSearch,
    page,
    pageSize,
  }), [debouncedSearch, page, pageSize, statusFilter]);
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: platformKeys.organizations(query),
    queryFn: () => listPlatformOrganizations(query),
    placeholderData: keepPreviousData,
  });
  const organizations = data?.rows ?? [];
  const contractKpis = usePlatformOrganizationContractKpis();
  const isOrganizationListRefreshing = isFetching && !isPending;
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const resetPage = () => setPagination({ page: 1, pageSize });
  const changePage = (nextPage: number) => setPagination({ page: nextPage, pageSize });

  return (
    <PlatformPageContainer
      maxWidthClassName="max-w-none"
      paddingClassName="flex h-[calc(100dvh-62px)] flex-col gap-4 overflow-auto px-5 pb-[22px] pt-[22px] sm:px-6 sm:pb-[30px]"
    >
      <PlatformTopBarActions>
        <Button
          variant="primary"
          type="button"
          onClick={() => setCreateOpen(true)}
          className="shrink-0 cursor-pointer border border-transparent transition-colors"
        >
          ＋ 신규 테넌트
        </Button>
      </PlatformTopBarActions>

      <section className="grid flex-none gap-[13px] sm:grid-cols-2 xl:grid-cols-4" aria-label="계약 현황">
        {[
          {
            label: "운영 중",
            value: contractKpis.data?.operatingCount,
            detail: `전체 ${formatNumber(contractKpis.data?.operatingCount ?? 0)}곳`,
          },
          {
            label: "90일 내 만료",
            value: contractKpis.data?.expiringWithin90DaysCount,
            detail: "연장 확인 필요",
          },
          {
            label: "정지",
            value: contractKpis.data?.suspendedCount,
            detail: "계약 확인 필요",
          },
          {
            label: "해지",
            value: contractKpis.data?.terminatedLast12MonthsCount,
            detail: "최근 12개월",
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-[15px] bg-surface px-[18px] py-[17px] leading-[normal] shadow-card">
            <div className="text-[12.5px] font-bold text-t3">{kpi.label}</div>
            <div className="mt-[9px] text-[26px] font-extrabold tracking-[-0.03em] text-t1 num">
              {contractKpis.isPending ? "-" : formatNumber(kpi.value ?? 0)}
              <span className="ml-[3px] text-[14px] font-bold tracking-normal text-t3">곳</span>
            </div>
            <div className={["mt-[7px] text-[12px] font-bold num", kpi.label === "정지" ? "text-red" : "text-t3"].join(" ")}>
              {kpi.detail}
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-none flex-col flex-wrap gap-2.5 sm:flex-row sm:items-center">
        <div
          className="inline-flex w-fit flex-wrap items-center gap-0.5 rounded-[11px] bg-[#EDF0F3] p-1"
          aria-label="테넌트 상태 필터"
        >
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={statusFilter === filter.id}
              onClick={() => {
                setStatusFilter(filter.id);
                resetPage();
              }}
              className={[
                "cursor-pointer rounded-lg px-[15px] py-[7px] text-sm font-bold transition-colors",
                statusFilter === filter.id
                  ? "bg-surface text-t1 shadow-[0_2px_6px_rgba(23,31,40,0.1)]"
                  : "text-t3 hover:text-t1",
              ].join(" ")}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <label className="flex h-10 min-w-60 items-center gap-2 rounded-[11px] border border-line bg-surface px-[13px] focus-within:border-blue focus-within:ring-[3px] focus-within:ring-blue-t">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 shrink-0 text-t3"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
            placeholder="업체명 · 지역 검색"
            className="w-full bg-transparent text-[13.5px] font-semibold text-t1 outline-none placeholder:font-medium placeholder:text-t4"
          />
        </label>
      </div>

      <section className="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-2xl bg-surface shadow-card">
        <div className="flex flex-none items-center gap-2.5 border-b border-line2 px-[18px] py-[15px]">
          <h3 className="text-[15px] font-extrabold text-t1">테넌트 목록</h3>
          <span className="text-xs font-semibold text-t3">{formatNumber(totalCount)}곳</span>
          {isOrganizationListRefreshing ? (
            <Spinner label="테넌트 목록 갱신 중" size="small" showLabel className="px-2 py-1" />
          ) : null}
        </div>

        <div ref={scrollerRef} className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse leading-[normal]">
            <thead>
              <tr>
                <th className="w-[24%] whitespace-nowrap border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-left text-[12px] font-bold text-t3">업체명</th>
                <th className="whitespace-nowrap border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-right text-[12px] font-bold text-t3">건물</th>
                <th className="whitespace-nowrap border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-right text-[12px] font-bold text-t3">세대</th>
                <th className="whitespace-nowrap border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-right text-[12px] font-bold text-t3">직원</th>
                <th className="whitespace-nowrap border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-right text-[12px] font-bold text-t3">세입자</th>
                <th className="whitespace-nowrap border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-left text-[12px] font-bold text-t3">상태</th>
                <th className="whitespace-nowrap border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-left text-[12px] font-bold text-t3">계약 시작</th>
                <th className="whitespace-nowrap border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-left text-[12px] font-bold text-t3">계약 만료</th>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {organizations.map((organization) => (
                <tr
                  key={organization.id}
                  tabIndex={0}
                  onClick={() => setDetailTarget(organization)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setDetailTarget(organization);
                  }}
                  className="cursor-pointer hover:bg-row-hover"
                >
                  <td className="whitespace-nowrap border-b border-line2 px-4 py-3 text-[13.5px] text-t1">
                    <div className="text-[14px] font-extrabold tracking-[-0.01em] text-t1">{organization.name}</div>
                    <span className="mt-[3px] block text-[12px] font-semibold text-t3">{organization.region ?? "지역 미설정"}</span>
                  </td>
                  <td className="whitespace-nowrap border-b border-line2 px-4 py-3 text-right text-[13.5px] text-t1 num">{formatNumber(organization.buildingCount)}</td>
                  <td className="whitespace-nowrap border-b border-line2 px-4 py-3 text-right text-[13.5px] text-t1 num">{formatNumber(organization.unitCount)}</td>
                  <td className="whitespace-nowrap border-b border-line2 px-4 py-3 text-right text-[13.5px] text-t1 num">{formatNumber(organization.employeeCount)}</td>
                  <td className="whitespace-nowrap border-b border-line2 px-4 py-3 text-right text-[13.5px] text-t1 num">{formatNumber(organization.tenantCount)}</td>
                  <td className="whitespace-nowrap border-b border-line2 px-4 py-3 text-[13.5px] text-t1"><TenantStatusBadge organization={organization} /></td>
                  <td className="whitespace-nowrap border-b border-line2 px-4 py-3 text-[13.5px] text-t3 num">{formatContractDate(organization.contractStartDate)}</td>
                  <td className="whitespace-nowrap border-b border-line2 px-4 py-3 text-[13.5px] text-t3 num">{formatContractDate(organization.contractEndDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {isPending ? (
            <div className="py-16">
              <Spinner label="테넌트 목록 불러오는 중" />
            </div>
          ) : isError ? (
            <div className="p-4">
              <QueryError onRetry={() => void refetch()} />
            </div>
          ) : organizations.length === 0 ? (
            <EmptyState
              message={
                search || statusFilter !== "all"
                  ? "해당 조건의 테넌트가 없습니다"
                  : "조회 가능한 테넌트가 없습니다"
              }
            />
          ) : null}
        </div>

        <div className="flex-none">
          <PlatformPagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={changePage}
            numeric
            compact
            totalLabel={`전체 ${formatNumber(totalCount)}곳 · ${formatNumber(page)}/${formatNumber(totalPages)}`}
          />
        </div>
      </section>

      {createOpen && (
        <OrgFormModal mode="create" onClose={() => setCreateOpen(false)} />
      )}
      {detailTarget && (
        <OrgFormModal mode="edit" organization={detailTarget} onClose={() => setDetailTarget(null)} />
      )}
    </PlatformPageContainer>
  );
}
