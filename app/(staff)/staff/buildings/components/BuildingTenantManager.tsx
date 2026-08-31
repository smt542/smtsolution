"use client";
import { useMemo, useState } from "react";
import { PrinterIcon } from "@/components/icons";
import {
  useBuildingList,
  type BuildingListResult,
} from "@/hooks/reactquery/buildings";
import { useTenantList } from "@/hooks/reactquery/occupancies";
import { BuildingSearchCard } from "./BuildingSearchCard";
import { BuildingDirectoryCard } from "./BuildingDirectoryCard";
import { TenantOccupancyCard } from "./TenantOccupancyCard";
import { TenantManagementCardModal } from "./TenantManagementCardModal";
import { TenantOutputModal } from "./TenantOutputModal";

interface ManagementCardRequest {
  buildingId: number;
  unitId: number;
}

/**
 * Figma 673:39652 / 673:40619 — 건물·입주자 관리(통합 master-detail).
 * 상단 건물 표에서 건물을 선택하면 하단 입주민 표가 해당 건물로 채워진다.
 */
export function BuildingTenantManager({ initialData }: { initialData: BuildingListResult }) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<{ id: number; name: string } | null>(null);
  const [outputOpen, setOutputOpen] = useState(false);
  const [managementCardRequest, setManagementCardRequest] = useState<ManagementCardRequest | null>(null);

  const params = { search: search || undefined, page, pageSize };
  const isInitialQuery = !search && page === 1 && pageSize === 20;
  const { data, isLoading, isError } = useBuildingList(params, isInitialQuery ? initialData : undefined);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const tenant = useTenantList(selected?.id ?? 0);
  const tenantRows = tenant.data ?? [];

  const exportHref = useMemo(() => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    const qs = q.toString();
    return qs ? `/api/buildings/export?${qs}` : "/api/buildings/export";
  }, [search]);

  const runSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="flex min-h-full flex-col">
      {/* App bar */}
      <div className="sticky top-0 z-10 flex h-[62px] shrink-0 items-center gap-[12px] border-b border-line bg-surface px-[24px]">
        <h1 className="text-[19px] font-extrabold tracking-[-0.38px] text-t1">건물·입주자 관리</h1>
        <button
          type="button"
          onClick={() => setOutputOpen(true)}
          className="ml-auto inline-flex h-[40px] items-center gap-[6px] rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold text-t2 hover:bg-bg"
        >
          <PrinterIcon className="h-4 w-4" />
          입주자카드 및 부과내역 출력
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-[16px] px-[24px] pb-[24px] pt-[22px]">
        <BuildingSearchCard value={searchInput} onChange={setSearchInput} onSearch={runSearch} />
        <BuildingDirectoryCard
          rows={rows}
          total={total}
          selectedId={selected?.id ?? null}
          onSelect={(b) => setSelected({ id: b.id, name: b.name })}
          isLoading={isLoading}
          isError={isError}
          hasFilter={!!search}
          exportHref={exportHref}
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
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
