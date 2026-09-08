"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon, SearchIcon } from "@/components/icons";
import type { Building } from "@/hooks/reactquery/buildings";
import type { BuildingType } from "@/hooks/reactquery/buildingTypes";
import { BillingReferencePanel } from "./BillingReferencePanel";

interface BuildingDirectoryRailProps {
  buildings: Building[];
  buildingTypes: BuildingType[];
  selectedBuildingId: number | null;
  period: string;
  loading: boolean;
  editing: boolean;
  note: string;
  onNoteChange: (value: string) => void;
  onBuildingChange: (value: string) => void;
  onPeriodChange: (year: number, month: number) => void;
}

export function BuildingDirectoryRail({
  buildings,
  buildingTypes,
  selectedBuildingId,
  period,
  loading,
  editing,
  note,
  onNoteChange,
  onBuildingChange,
  onPeriodChange,
}: BuildingDirectoryRailProps) {
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState("");
  const [year, month] = period.split("-").map(Number);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, index) => currentYear - 5 + index);
  const typeById = useMemo(
    () => new Map(buildingTypes.map((type) => [type.id, type.label])),
    [buildingTypes],
  );
  const normalizedSearch = search.trim().toLocaleLowerCase("ko");
  const visibleBuildings = buildings.filter((building) => {
    const matchesGroup = !groupId || String(building.typeId ?? "") === groupId;
    const matchesSearch = !normalizedSearch || [building.code, building.name, building.address ?? ""]
      .some((value) => value.toLocaleLowerCase("ko").includes(normalizedSearch));
    return matchesGroup && matchesSearch;
  });
  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId) ?? null;

  const selectClass =
    "h-[32px] appearance-none rounded-[9px] border border-line bg-white pl-[11px] pr-[28px] text-[13px] font-bold tracking-[-0.01em] text-t1 outline-none focus:border-teal";

  return (
    <aside className="grid min-h-0 grid-rows-[minmax(180px,1fr)_168px] gap-[12px]">
      <section className="flex min-h-[180px] flex-col overflow-hidden rounded-[16px] bg-surface shadow-card">
        <div className="h-[106px] shrink-0 border-b border-line2 px-[18px] pt-[15px]">
          <div className="flex h-[32px] items-center gap-[8px]">
            <h2 className="text-[15px] font-extrabold text-t1">전체 건물</h2>
            <div className="ml-auto flex items-center gap-[6px]">
              <label className="relative">
                <span className="sr-only">부과 연도</span>
                <select
                  aria-label="부과 연도"
                  value={year}
                  onChange={(event) => onPeriodChange(Number(event.target.value), month)}
                  className={`${selectClass} w-[88px]`}
                >
                  {years.map((option) => <option key={option} value={option}>{option}년</option>)}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-[9px] top-[9px] size-[14px] text-t3" />
              </label>
              <label className="relative">
                <span className="sr-only">부과 월</span>
                <select
                  aria-label="부과 월"
                  value={month}
                  onChange={(event) => onPeriodChange(year, Number(event.target.value))}
                  className={`${selectClass} w-[74px]`}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((option) => (
                    <option key={option} value={option}>{option}월분</option>
                  ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-[9px] top-[9px] size-[14px] text-t3" />
              </label>
            </div>
          </div>

          <div className="mt-[9px] flex h-[34px] items-center gap-[8px]">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">건물명·주소 검색</span>
              <SearchIcon className="pointer-events-none absolute left-[11px] top-[9px] size-[15px] text-t3" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="건물명·주소 검색"
                className="h-[34px] w-full rounded-[9px] border border-line bg-white pl-[31px] pr-[11px] text-[13px] font-semibold text-t1 outline-none placeholder:text-[#757575] focus:border-teal"
              />
            </label>
            <label className="relative w-[92px] shrink-0">
              <span className="sr-only">건물 그룹</span>
              <select
                aria-label="건물 그룹"
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                className={`${selectClass} w-full`}
              >
                <option value="">그룹 전체</option>
                {buildingTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-[9px] top-[9px] size-[14px] text-t3" />
            </label>
          </div>

          <select
            aria-label="건물 선택"
            value={selectedBuildingId?.toString() ?? ""}
            onChange={(event) => onBuildingChange(event.target.value)}
            className="sr-only"
          >
            <option value="">건물을 선택해 주세요</option>
            {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed text-[13.5px] text-t1">
            <colgroup>
              <col className="w-[58px]" />
              <col className="w-[118px]" />
              <col />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-[#fbfcfd] text-left text-[12px] font-bold text-t3">
              <tr className="h-[36px] border-b border-line">
                <th className="px-[11px]">코드</th>
                <th className="px-[11px]">건물명</th>
                <th className="px-[11px]">주소</th>
              </tr>
            </thead>
            <tbody>
              {visibleBuildings.map((building) => {
                const selected = building.id === selectedBuildingId;
                return (
                  <tr
                    key={building.id}
                    aria-selected={selected}
                    title={typeById.get(building.typeId ?? -1) ?? undefined}
                    onClick={() => onBuildingChange(String(building.id))}
                    className={`h-[41px] cursor-pointer border-b border-line2 ${selected ? "bg-[#e2f5f1] font-bold" : "hover:bg-bg"}`}
                  >
                    <td className="truncate px-[11px]">{building.code}</td>
                    <td className="truncate px-[11px]">{building.name}</td>
                    <td className="truncate px-[11px] font-medium">{building.address ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && visibleBuildings.length === 0 && (
            <p className="px-[18px] py-[30px] text-center text-[13px] text-t3">조건에 맞는 건물이 없습니다.</p>
          )}
          {loading && <p className="px-[18px] py-[30px] text-center text-[13px] text-t3">건물을 불러오는 중입니다.</p>}
        </div>
      </section>

      <BillingReferencePanel
        building={selectedBuilding}
        editing={editing}
        note={note}
        onNoteChange={onNoteChange}
      />
    </aside>
  );
}
