"use client";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Select, SearchBar, EmptyState, Spinner, DataTable, Pagination } from "@/components/common";
import {
  useBuildingList,
  useStaffOptions,
  type BuildingListResult,
} from "@/hooks/reactquery/buildings";

const PAGE_SIZES = [10, 20, 50] as const;

export function BuildingList({ initialData }: { initialData: BuildingListResult }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [manager, setManager] = useState("");
  const [meter, setMeter] = useState("");
  const [cleaning, setCleaning] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const { data: staff } = useStaffOptions();
  const staffOptions = useMemo(
    () => [{ value: "", label: "전체" }, ...(staff ?? []).map((s) => ({ value: s.userId, label: s.fullName }))],
    [staff],
  );

  const params = {
    search: search || undefined,
    managerUserId: manager || undefined,
    meterUserId: meter || undefined,
    cleaningUserId: cleaning || undefined,
    page,
    pageSize,
  };
  const isInitialQuery = !search && !manager && !meter && !cleaning && page === 1 && pageSize === 20;
  const { data, isLoading, isError } = useBuildingList(
    params,
    isInitialQuery ? initialData : undefined,
  );

  const rows = (data?.rows ?? []).map((b) => ({
    _id: b.id,
    name: b.name,
    address: b.address ?? "-",
    manager: b.managerName ?? "-",
    meter: b.meterName ?? "-",
    cleaning: b.cleaningName ?? "-",
    total: b.totalUnits,
    occupied: b.occupiedUnits,
  }));
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilter = !!(search || manager || meter || cleaning);

  const exportHref = () => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (manager) q.set("manager", manager);
    if (meter) q.set("meter", meter);
    if (cleaning) q.set("cleaning", cleaning);
    return `/api/buildings/export?${q.toString()}`;
  };

  const resetFilters = () => { setSearch(""); setManager(""); setMeter(""); setCleaning(""); setPage(1); };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-t1">건물 관리</h1>
        <div className="flex gap-2">
          <a href={exportHref()} className="inline-flex h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-t2 hover:bg-bg">
            엑셀 다운
          </a>
          <Button variant="primary" onClick={() => router.push("/staff/buildings/new")}>+ 건물 등록</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-64"><SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="건물명·주소 검색" /></div>
        <div className="w-40"><Select aria-label="관리담당자" options={staffOptions} value={manager} onChange={(e) => { setManager(e.target.value); setPage(1); }} /></div>
        <div className="w-40"><Select aria-label="검침담당자" options={staffOptions} value={meter} onChange={(e) => { setMeter(e.target.value); setPage(1); }} /></div>
        <div className="w-40"><Select aria-label="청소담당자" options={staffOptions} value={cleaning} onChange={(e) => { setCleaning(e.target.value); setPage(1); }} /></div>
        {hasFilter && <Button variant="ghost" onClick={resetFilters}>필터 초기화</Button>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : isError ? (
        <EmptyState message="데이터를 불러오지 못했습니다. 다시 시도해 주세요." />
      ) : rows.length === 0 ? (
        <EmptyState message={hasFilter ? "조건에 맞는 건물이 없습니다." : "등록된 건물이 없습니다."} />
      ) : (
        <>
          <DataTable
            columns={[
              { key: "name", label: "건물명" }, { key: "address", label: "주소" },
              { key: "manager", label: "관리담당자" }, { key: "meter", label: "검침담당자" },
              { key: "cleaning", label: "청소담당자" }, { key: "total", label: "총세대수" },
              { key: "occupied", label: "입주세대수" },
            ]}
            rows={rows}
            onRowDoubleClick={(r) => router.push(`/staff/buildings/${r._id}`)}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZES}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </>
      )}
    </div>
  );
}
