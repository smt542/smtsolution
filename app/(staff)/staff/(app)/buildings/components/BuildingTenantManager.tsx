"use client";
import { useMemo, useState } from "react";
import { IconButton } from "@/components/common";
import {
  useBuildingList,
  useStaffOptions,
  type BuildingListResult,
} from "@/hooks/reactquery/buildings";
import { useTenantList } from "@/hooks/reactquery/occupancies";
import { useBuildingMeterDays, type CustomerNumberKind } from "@/hooks/reactquery/buildingCustomerNumbers";
import {
  BuildingSearchCard,
  initialBuildingFilter,
  isFilterActive,
  type BuildingFilterState,
  type MeterKind,
} from "./BuildingSearchCard";
import { BuildingDirectoryCard } from "./BuildingDirectoryCard";
import { TenantOccupancyCard } from "./TenantOccupancyCard";
import { TenantManagementCardModal } from "./TenantManagementCardModal";
import { TenantOutputModal } from "./TenantOutputModal";

interface ManagementCardRequest {
  buildingId: number;
  unitId: number;
}

const METER_KIND_MAP: Record<Exclude<MeterKind, "">, CustomerNumberKind> = {
  수도: "water",
  전기: "elec",
  가스: "gas",
  공용전기: "common_elec",
};

/**
 * Figma 673:39652 / 673:40619 — 건물·입주자 관리(통합 master-detail).
 * 상단 건물 표에서 건물을 선택하면 하단 입주민 표가 해당 건물로 채워진다.
 */
export function BuildingTenantManager({ initialData }: { initialData: BuildingListResult }) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filter, setFilter] = useState<BuildingFilterState>(initialBuildingFilter);
  const [selected, setSelected] = useState<{ id: number; name: string } | null>(null);
  const [outputOpen, setOutputOpen] = useState(false);
  const [managementCardRequest, setManagementCardRequest] = useState<ManagementCardRequest | null>(null);

  // 담당자(사무/현장/청소) 필터는 서버 재조회, 등록일/검침일 정렬은 현재 페이지 클라이언트 정렬.
  const params = {
    search: search || undefined,
    managerUserId: filter.managerUserId ?? undefined,
    meterUserId: filter.meterUserId ?? undefined,
    cleaningUserId: filter.cleaningUserId ?? undefined,
    page,
    pageSize,
  };
  const isInitialQuery =
    !search &&
    page === 1 &&
    pageSize === 20 &&
    !filter.managerUserId &&
    !filter.meterUserId &&
    !filter.cleaningUserId;
  const { data, isLoading, isError } = useBuildingList(params, isInitialQuery ? initialData : undefined);

  const rawRows = useMemo(() => data?.rows ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 담당자 칩 옵션: 활성 직원 계정(중복 id 제거).
  const { data: staff } = useStaffOptions();
  const staffChips = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; name: string }[] = [];
    for (const s of staff ?? []) {
      if (!s.isActive || seen.has(s.userId)) continue;
      seen.add(s.userId);
      out.push({ id: s.userId, name: s.fullName });
    }
    return out;
  }, [staff]);

  // 검침일 필터: 현재 페이지 건물들의 항목별 검침일 조회 → 컬럼/정렬.
  const meterActive = filter.meterKind !== "";
  const rowIds = useMemo(() => rawRows.map((r) => r.id), [rawRows]);
  const { data: meterDayMap } = useBuildingMeterDays(rowIds, meterActive);
  const meterKind = meterActive ? METER_KIND_MAP[filter.meterKind as Exclude<MeterKind, "">] : null;
  const meterDayByBuilding = useMemo(() => {
    const out: Record<number, number | undefined> = {};
    if (!meterKind || !meterDayMap) return out;
    for (const id of rowIds) out[id] = meterDayMap[id]?.[meterKind];
    return out;
  }, [meterKind, meterDayMap, rowIds]);

  const rows = useMemo(() => {
    const list = [...rawRows];
    if (meterActive) {
      list.sort((a, b) => {
        const x = meterDayByBuilding[a.id] ?? Number.POSITIVE_INFINITY;
        const y = meterDayByBuilding[b.id] ?? Number.POSITIVE_INFINITY;
        if (x !== y) return filter.meterDir === "asc" ? x - y : y - x;
        return a.code.localeCompare(b.code);
      });
    } else if (filter.regSort === "asc") {
      // 서버 기본 정렬(등록일 최신순)을 현재 페이지 한정 뒤집어 오래된 순으로.
      list.reverse();
    }
    return list;
  }, [rawRows, meterActive, meterDayByBuilding, filter.meterDir, filter.regSort]);

  const exportHref = useMemo(() => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    const qs = q.toString();
    return qs ? `/api/buildings/export?${qs}` : "/api/buildings/export";
  }, [search]);

  const tenant = useTenantList(selected?.id ?? 0);
  const tenantRows = tenant.data ?? [];

  const runSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleFilterChange = (next: BuildingFilterState) => {
    if (
      next.managerUserId !== filter.managerUserId ||
      next.meterUserId !== filter.meterUserId ||
      next.cleaningUserId !== filter.cleaningUserId
    ) {
      setPage(1);
    }
    setFilter(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* App bar */}
      <div className="sticky top-0 z-10 flex h-[62px] shrink-0 items-center gap-[12px] border-b border-line bg-surface px-[24px]">
        <IconButton
          onClick={() => window.dispatchEvent(new Event("app-shell:toggle-sidebar"))}
          className="mr-[2px] h-[36px] w-[36px] shrink-0 rounded-[10px] text-t2 transition-colors hover:bg-bg"
          aria-label="메뉴 열기"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[20px] w-[20px]"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </IconButton>
        <h1 className="text-[19px] font-extrabold leading-[normal] tracking-[-0.38px] text-t1">건물·입주자 관리</h1>
        <button
          type="button"
          onClick={() => setOutputOpen(true)}
          className="ml-auto inline-flex h-[40px] items-center gap-[6px] rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold leading-[normal] text-t2 hover:bg-bg"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M6 9V3h12v6" />
            <path d="M6 18H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2" />
            <rect x="7" y="14" width="10" height="7" />
          </svg>
          입주자카드 및 부과내역 출력
        </button>
      </div>

      {/* Content */}
      <div className="flex min-h-0 flex-1 flex-col gap-[16px] overflow-hidden px-[24px] pb-[24px] pt-[22px]">
        <BuildingSearchCard
          value={searchInput}
          onChange={setSearchInput}
          onSearch={runSearch}
          filter={filter}
          onFilterChange={handleFilterChange}
          staff={staffChips}
        />
        <BuildingDirectoryCard
          rows={rows}
          total={total}
          selectedId={selected?.id ?? null}
          onSelect={(b) => setSelected({ id: b.id, name: b.name })}
          isLoading={isLoading}
          isError={isError}
          hasFilter={!!search || isFilterActive(filter)}
          exportHref={exportHref}
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
          meterDayActive={meterActive}
          meterDayByBuilding={meterDayByBuilding}
        />
        <TenantOccupancyCard
          buildingId={selected?.id ?? null}
          buildingName={selected?.name ?? null}
          rows={tenantRows}
          isLoading={tenant.isLoading}
          isError={tenant.isError}
          onOpenManagementCard={(tenantRow) => {
            if (!selected) return;
            setManagementCardRequest({ buildingId: selected.id, unitId: tenantRow.unitId });
          }}
        />
      </div>

      {outputOpen && (
        <TenantOutputModal
          initialBuildingId={selected?.id ?? null}
          onClose={() => setOutputOpen(false)}
        />
      )}

      {managementCardRequest && (
        <TenantManagementCardModal
          key={`${managementCardRequest.buildingId}-${managementCardRequest.unitId}`}
          buildingId={managementCardRequest.buildingId}
          unitId={managementCardRequest.unitId}
          onClose={() => setManagementCardRequest(null)}
        />
      )}
    </div>
  );
}
