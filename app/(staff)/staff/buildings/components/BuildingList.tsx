"use client";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Select, SearchBar, EmptyState, Spinner, Pagination } from "@/components/common";
import { PrinterIcon, UnitCardIcon } from "@/components/icons";
import {
  useBuildingList,
  useStaffOptions,
  type BuildingListResult,
} from "@/hooks/reactquery/buildings";
import { useTenantList } from "@/hooks/reactquery/occupancies";
import { BuildingOutputModal } from "./BuildingOutputModal";

const PAGE_SIZES = [10, 20, 50] as const;

export function BuildingList({ initialData }: { initialData: BuildingListResult }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [manager, setManager] = useState("");
  const [meter, setMeter] = useState("");
  const [cleaning, setCleaning] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [outputModalOpen, setOutputModalOpen] = useState(false);

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
  const selectedBuilding = data?.rows.find((building) => building.id === selectedBuildingId) ?? null;
  const tenantQuery = useTenantList(selectedBuildingId ?? 0);

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
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] font-semibold text-t3">관리업무</p>
          <h1 className="mt-1 text-[24px] font-extrabold tracking-[-0.6px] text-t1">건물·입주자 관리</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOutputModalOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#A9DCD7] bg-white px-4 text-[13px] font-bold text-[#128B81] hover:bg-[#F0FAF9]"
          >
            <PrinterIcon className="size-4" />
            입주자카드 및 부과내역 출력
          </button>
          <Button variant="primary" onClick={() => router.push("/staff/buildings/new")}>+ 건물 등록</Button>
        </div>
      </div>

      <section className="overflow-hidden rounded-[14px] border border-line bg-white shadow-[0_1px_2px_rgba(25,31,40,0.03)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <div className="min-w-[240px] flex-1"><SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="건물명·주소 검색" /></div>
          <div className="w-36"><Select aria-label="관리담당자" options={staffOptions} value={manager} onChange={(e) => { setManager(e.target.value); setPage(1); }} /></div>
          <div className="w-36"><Select aria-label="검침담당자" options={staffOptions} value={meter} onChange={(e) => { setMeter(e.target.value); setPage(1); }} /></div>
          <div className="w-36"><Select aria-label="청소담당자" options={staffOptions} value={cleaning} onChange={(e) => { setCleaning(e.target.value); setPage(1); }} /></div>
          {hasFilter && <Button variant="ghost" onClick={resetFilters}>필터 초기화</Button>}
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-extrabold text-t1">전체 건물</h2>
            <span className="rounded-full bg-[#E9F8F6] px-2 py-0.5 text-[10px] font-bold text-teal">{total}곳</span>
          </div>
          <a href={exportHref()} className="text-[12px] font-bold text-t3 hover:text-t1">엑셀 다운</a>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : isError ? (
          <div className="px-4 pb-4"><EmptyState message="데이터를 불러오지 못했습니다. 다시 시도해 주세요." /></div>
        ) : rows.length === 0 ? (
          <div className="px-4 pb-4"><EmptyState message={hasFilter ? "조건에 맞는 건물이 없습니다." : "등록된 건물이 없습니다."} /></div>
        ) : (
          <>
            <div className="overflow-x-auto border-y border-line">
              <table className="min-w-[980px] w-full table-fixed text-[12px]">
                <thead className="bg-bg text-t2">
                  <tr>
                    {[['code', '코드'], ['name', '건물명'], ['address', '주소'], ['manager', '관리담당'], ['meter', '검침담당'], ['cleaning', '청소담당'], ['total', '총 세대'], ['occupied', '입주 세대']].map(([key, label]) => (
                      <th key={key} className={`h-9 px-3 text-left font-bold ${key === 'address' ? 'w-[25%]' : ''}`}>{label}</th>
                    ))}
                    <th className="w-16 px-3 text-center font-bold">동작</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows ?? []).map((building) => {
                    const selected = building.id === selectedBuildingId;
                    return (
                      <tr
                        key={building.id}
                        onClick={() => setSelectedBuildingId(building.id)}
                        onDoubleClick={() => router.push(`/staff/buildings/${building.id}`)}
                        aria-selected={selected}
                        className={`cursor-pointer border-t border-line transition ${selected ? 'bg-[#E9F8F6]' : 'hover:bg-bg'}`}
                      >
                        <td className="h-10 px-3 font-semibold text-t3">{building.code}</td>
                        <td className={`px-3 font-bold ${selected ? 'text-[#0F857B]' : 'text-t1'}`}>{building.name}</td>
                        <td className="truncate px-3 text-t2">{building.address ?? '-'}</td>
                        <td className="px-3 text-t2">{building.managerName ?? '-'}</td>
                        <td className="px-3 text-t2">{building.meterName ?? '-'}</td>
                        <td className="px-3 text-t2">{building.cleaningName ?? '-'}</td>
                        <td className="px-3 text-t2">{building.totalUnits}</td>
                        <td className="px-3 text-t2">{building.occupiedUnits}</td>
                        <td className="px-3 text-center">
                          <button type="button" onClick={(event) => { event.stopPropagation(); router.push(`/staff/buildings/${building.id}`); }} className="font-bold text-teal hover:underline">상세</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZES}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
              className="p-3"
            />
          </>
        )}
      </section>

      <section className="min-h-[280px] overflow-hidden rounded-[14px] border border-line bg-white shadow-[0_1px_2px_rgba(25,31,40,0.03)]">
        <div className="flex h-[54px] items-center justify-between border-b border-line px-4">
          <div>
            <h2 className="text-[14px] font-extrabold text-t1">호수·입주민 관리</h2>
            {selectedBuilding && <p className="mt-0.5 text-[10px] text-t3">{selectedBuilding.name} · {tenantQuery.data?.length ?? 0}세대</p>}
          </div>
          {selectedBuilding && (
            <Button variant="primary" className="h-9 text-[12px]" onClick={() => router.push(`/staff/buildings/${selectedBuilding.id}/tenants/new`)}>+ 호수·입주민 등록</Button>
          )}
        </div>

        {!selectedBuilding ? (
          <div className="flex min-h-[224px] flex-col items-center justify-center gap-1.5">
            <UnitCardIcon className="size-6 text-teal" />
            <p className="text-[13px] font-bold text-t2">건물을 선택해 주세요</p>
            <p className="text-[11px] text-t3">위 건물 목록에서 관리할 건물을 선택해 주세요.</p>
          </div>
        ) : tenantQuery.isLoading ? (
          <div className="flex min-h-[224px] items-center justify-center"><Spinner /></div>
        ) : tenantQuery.isError ? (
          <div className="p-4"><EmptyState message="입주민 목록을 불러오지 못했습니다." /></div>
        ) : (tenantQuery.data?.length ?? 0) === 0 ? (
          <div className="p-4"><EmptyState message="등록된 호수·입주민이 없습니다." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-[12px]">
              <thead className="bg-bg text-t2">
                <tr>{['호실', '입주자명', '연락처', '룸 타입', '인원', '입주일', '공실', '연체'].map((label) => <th key={label} className="h-9 px-4 text-left font-bold">{label}</th>)}</tr>
              </thead>
              <tbody>
                {(tenantQuery.data ?? []).map((tenant) => (
                  <tr key={tenant.unitId} onDoubleClick={() => router.push(`/staff/buildings/${selectedBuilding.id}/tenants/${tenant.unitId}`)} className="cursor-pointer border-t border-line hover:bg-bg">
                    <td className="h-10 px-4 font-bold text-t1">{tenant.unitNo}</td>
                    <td className="px-4 text-t1">{tenant.isVacant ? '공실' : tenant.tenantName ?? '-'}</td>
                    <td className="px-4 text-t2">{tenant.phone ?? '-'}</td>
                    <td className="px-4 text-t2">{tenant.roomTypeLabel ?? '-'}</td>
                    <td className="px-4 text-t2">{tenant.residentCount ?? '-'}</td>
                    <td className="px-4 text-t2">{tenant.moveInDate ?? '-'}</td>
                    <td className="px-4"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tenant.isVacant ? 'bg-[#FFF3E7] text-[#E97816]' : 'bg-[#E9F8F6] text-teal'}`}>{tenant.isVacant ? '공실' : '입주'}</span></td>
                    <td className="px-4 text-t2">{tenant.isOverdue ? '연체' : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <BuildingOutputModal
        open={outputModalOpen}
        buildings={data?.rows ?? []}
        selectedBuildingId={selectedBuildingId}
        tenants={tenantQuery.data ?? []}
        tenantsLoading={tenantQuery.isLoading}
        onSelectBuilding={setSelectedBuildingId}
        onClose={() => setOutputModalOpen(false)}
      />
    </div>
  );
}
