"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon, ChevronLeftIcon, SearchIcon } from "@/components/icons";
import type { Building } from "@/hooks/reactquery/buildings";
import { useTenantList } from "@/hooks/reactquery/occupancies";
import type { Unit } from "@/hooks/reactquery/units";

function displayDate(value: string | null): string {
  return value ? value.replaceAll("-", ".") : "";
}

export function SettlementDirectoryRail({
  buildings,
  units,
  buildingId,
  unitId,
  buildingsLoading,
  unitsLoading,
  settlementDate,
  settlementNote,
  onSelectBuilding,
  onSelectUnit,
  onStartNew,
}: {
  buildings: Building[];
  units: Unit[];
  buildingId: number | null;
  unitId: number | null;
  buildingsLoading: boolean;
  unitsLoading: boolean;
  settlementDate: string | null;
  settlementNote: string | null;
  onSelectBuilding: (id: number | null) => void;
  onSelectUnit: (id: number | null) => void;
  onStartNew: () => void;
}) {
  const [search, setSearch] = useState("");
  const selectedBuilding =
    buildings.find((building) => building.id === buildingId) ?? null;
  const selectedUnit = units.find((unit) => unit.id === unitId) ?? null;
  const visibleBuildings = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ko-KR");
    if (!query) return buildings;
    return buildings.filter((building) =>
      [building.code, building.name, building.address ?? ""]
        .join(" ")
        .toLocaleLowerCase("ko-KR")
        .includes(query),
    );
  }, [buildings, search]);

  const tenantQuery = useTenantList(buildingId ?? 0);
  const tenants = tenantQuery.data ?? [];

  if (selectedBuilding && selectedUnit) {
    return (
      <aside className="flex min-h-0 flex-col gap-[16px] overflow-hidden">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
          <div className="h-[96px] shrink-0 border-b border-line2 px-[18px] pt-[15px]">
            <div className="flex h-[24px] items-center gap-[8px]">
              <button
                type="button"
                aria-label="호실 목록으로 돌아가기"
                onClick={() => onSelectUnit(null)}
                className="grid size-[24px] place-items-center rounded-[7px] text-t2 hover:bg-bg"
              >
                <ChevronLeftIcon className="size-[20px]" />
              </button>
              <h2 className="truncate text-[15px] font-extrabold text-t1">
                {selectedBuilding.name} {selectedUnit.unitNo}
              </h2>
            </div>
            <button
              type="button"
              onClick={onStartNew}
              className="mt-[9px] h-[32px] w-full rounded-[9px] bg-teal text-[13.5px] font-bold text-white hover:bg-teal-d"
            >
              새 이사정산 입력
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="grid h-[37px] grid-cols-[52px_1fr] border-b border-line bg-[#fbfcfd] text-[12px] font-bold text-t3">
              <span className="px-[16px] py-[11px]">No</span>
              <span className="px-[16px] py-[11px]">이사정산 입력 날짜</span>
            </div>
            {settlementDate ? (
              <button
                type="button"
                className="grid h-[41px] w-full grid-cols-[52px_1fr] bg-teal-t text-left text-[13.5px] text-t1"
              >
                <span className="px-[16px] py-[12px]">1</span>
                <span className="px-[16px] py-[12px]">
                  {displayDate(settlementDate)}
                </span>
              </button>
            ) : (
              <p className="px-[16px] py-[14px] text-[12.5px] text-t4">
                작성된 이사정산이 없습니다.
              </p>
            )}
          </div>
        </section>

        <section className="h-[132px] shrink-0 overflow-hidden rounded-[16px] bg-white shadow-card">
          <div className="flex h-[48px] items-center border-b border-line2 px-[18px]">
            <h2 className="text-[14px] font-semibold text-t1">이사정산시 적요</h2>
          </div>
          <p className="px-[16px] py-[13px] text-[13.5px] leading-[22px] text-t1">
            {settlementNote || "등록된 이사정산 적요가 없습니다."}
          </p>
        </section>
      </aside>
    );
  }

  if (selectedBuilding) {
    return (
      <aside className="flex min-h-0 flex-col gap-[16px] overflow-hidden">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
          <div className="flex h-[49px] shrink-0 items-center gap-[8px] border-b border-line2 px-[18px]">
            <button
              type="button"
              aria-label="전체 건물로 돌아가기"
              onClick={() => onSelectBuilding(null)}
              className="grid size-[24px] place-items-center rounded-[7px] text-t2 hover:bg-bg"
            >
              <ChevronLeftIcon className="size-[20px]" />
            </button>
            <h2 className="truncate text-[15px] font-extrabold text-t1">
              {selectedBuilding.name}
            </h2>
          </div>
          <div className="grid h-[37px] shrink-0 grid-cols-[64px_1fr] border-b border-line bg-[#fbfcfd] text-[12px] font-bold text-t3">
            <span className="px-[16px] py-[11px]">호수</span>
            <span className="px-[16px] py-[11px]">세대주</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {(unitsLoading || tenantQuery.isLoading) && (
              <p className="px-[16px] py-[14px] text-[12.5px] text-t4">
                호실을 불러오는 중입니다.
              </p>
            )}
            {!unitsLoading && !tenantQuery.isLoading && tenants.length === 0 && (
              <p className="px-[16px] py-[14px] text-[12.5px] text-t4">
                등록된 호실이 없습니다.
              </p>
            )}
            {tenants.map((tenant) => {
              const vacant = tenant.isVacant || !tenant.tenantName;
              return (
                <button
                  key={tenant.unitId}
                  type="button"
                  onClick={() => onSelectUnit(tenant.unitId)}
                  className="grid min-h-[41px] w-full grid-cols-[64px_1fr] border-b border-line2 text-left text-[13.5px] text-t1 hover:bg-[#fbfcfd]"
                >
                  <span className="px-[16px] py-[12px] font-bold">{tenant.unitNo}</span>
                  <span className={`truncate px-[16px] py-[12px] ${vacant ? "text-t4" : ""}`}>
                    {vacant ? "공실" : tenant.tenantName}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="h-[132px] shrink-0 overflow-hidden rounded-[16px] bg-white shadow-card">
          <div className="flex h-[48px] items-center border-b border-line2 px-[18px]">
            <h2 className="text-[14px] font-semibold text-t1">이사정산시 적요</h2>
          </div>
          <p className="px-[16px] py-[13px] text-[13.5px] leading-[22px] text-t4">
            호실을 선택하면 표시돼요
          </p>
        </section>
      </aside>
    );
  }

  return (
    <aside className="flex min-h-0 flex-col gap-[16px] overflow-hidden">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
        <div className="shrink-0 px-[18px] pb-[9px] pt-[15px]">
          <h2 className="text-[15px] font-extrabold text-t1">전체 건물</h2>
          <div className="mt-[9px] flex gap-[8px]">
            <label className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute left-[10px] top-[9px] size-[15px] text-t3" />
              <input
                aria-label="건물·주소 검색"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="건물명·주소 검색"
                className="h-[34px] w-full rounded-[9px] border border-line bg-white pl-[31px] pr-[9px] text-[12px] text-t1 outline-none placeholder:text-t4 focus:border-teal"
              />
            </label>
            <button
              type="button"
              className="flex h-[34px] w-[72px] items-center justify-center gap-[4px] rounded-[9px] border border-line bg-white text-[11px] font-bold text-t2"
            >
              그룹 전체 <ChevronDownIcon className="size-[12px]" />
            </button>
          </div>
        </div>
        <div className="grid h-[37px] shrink-0 grid-cols-[64px_96px_1fr] border-y border-line bg-[#fbfcfd] text-[12px] font-bold text-t3">
          <span className="px-[16px] py-[11px]">코드</span>
          <span className="px-[16px] py-[11px]">건물명</span>
          <span className="px-[16px] py-[11px]">주소</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {buildingsLoading && (
            <p className="px-[16px] py-[14px] text-[12.5px] text-t4">
              건물을 불러오는 중입니다.
            </p>
          )}
          {!buildingsLoading && visibleBuildings.length === 0 && (
            <p className="px-[16px] py-[14px] text-[12.5px] text-t4">
              검색 결과가 없습니다.
            </p>
          )}
          {visibleBuildings.map((building) => (
            <button
              key={building.id}
              type="button"
              onClick={() => onSelectBuilding(building.id)}
              className="grid min-h-[41px] w-full grid-cols-[64px_96px_1fr] border-b border-line2 text-left text-[12.5px] text-t1 hover:bg-[#fbfcfd]"
            >
              <span className="px-[16px] py-[12px]">{building.code}</span>
              <span className="truncate px-[16px] py-[12px] font-bold">
                {building.name}
              </span>
              <span className="truncate px-[16px] py-[12px]">
                {building.address ?? "-"}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="h-[132px] shrink-0 overflow-hidden rounded-[16px] bg-white shadow-card">
        <div className="flex h-[48px] items-center border-b border-line2 px-[18px]">
          <h2 className="text-[14px] font-semibold text-t1">이사정산시 적요</h2>
        </div>
        <p className="px-[16px] py-[13px] text-[13.5px] leading-[22px] text-t4">
          건물과 호실을 선택하면 표시돼요
        </p>
      </section>
    </aside>
  );
}
