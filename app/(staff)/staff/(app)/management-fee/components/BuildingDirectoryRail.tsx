"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { CustomDropdown } from "@/components/common/CustomDropdown";
import type { Building } from "@/hooks/reactquery/buildings";
import type { BuildingType } from "@/hooks/reactquery/buildingTypes";
import { BillingReferencePanel } from "./BillingReferencePanel";

const dropdownCallSiteClass = [
  "[&_.uc-dd-btn_svg]:h-[14px]",
  "[&_.uc-dd-btn_svg]:w-[14px]",
  "[&_.uc-dd:not(.open)_.uc-dd-btn:hover]:border-[#C9D0D8]",
  "[&_.uc-dd:not(.open)_.uc-dd-btn:hover]:shadow-none",
  "[&_.uc-dd-menu]:p-[5px]",
  "[&_.uc-opt]:gap-[10px]",
  "[&_.uc-opt:not(.on):hover]:bg-[#F5F7F9]",
].join(" ");

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
  const yearOptions = useMemo(
    () => years.map((option) => ({ value: String(option), label: `${option}년` })),
    [years],
  );
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `${index + 1}월분` })),
    [],
  );
  const groupOptions = useMemo(
    () => [
      { value: "", label: "그룹 전체" },
      ...buildingTypes.map((type) => ({ value: String(type.id), label: type.label })),
    ],
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

  return (
    <aside className="grid min-h-0 grid-rows-[minmax(180px,1fr)_168px] gap-[12px]">
      <section className="flex min-h-[180px] flex-col overflow-hidden rounded-[16px] bg-surface shadow-card">
        <div className="flex shrink-0 flex-col items-stretch gap-[9px] border-b border-line2 px-[18px] py-[15px]">
          <div className="flex flex-wrap items-center gap-[8px] gap-y-[8px]">
            <h2 className="whitespace-nowrap text-[15px] font-extrabold text-t1">전체 건물</h2>
            <div className="flex-1" />
            <div className="flex flex-none items-center gap-[6px]">
              <div className={`${dropdownCallSiteClass} [&_.uc-dd-menu]:min-w-[104px]`}>
                <CustomDropdown
                  ariaLabel="부과 연도"
                  value={String(year)}
                  options={yearOptions}
                  compact
                  onChange={(value) => onPeriodChange(Number(value), month)}
                />
              </div>
              <div className={`${dropdownCallSiteClass} [&_.uc-dd-menu]:min-w-[112px]`}>
                <CustomDropdown
                  ariaLabel="부과 월"
                  value={String(month)}
                  options={monthOptions}
                  compact
                  onChange={(value) => onPeriodChange(year, Number(value))}
                />
              </div>
            </div>
          </div>

          <div className="flex w-full items-center gap-[8px]">
            <div className="relative w-full">
              <SearchIcon className="pointer-events-none absolute left-[11px] top-1/2 size-[15px] -translate-y-1/2 text-t3" />
              <input
                aria-label="건물명·주소 검색"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="건물명·주소 검색"
                className="h-[34px] w-full rounded-[9px] border border-line bg-white pl-[31px] pr-[11px] text-[13px] font-semibold text-t1 outline-none placeholder:text-[#757575] focus:border-teal"
              />
            </div>
            <div className={`${dropdownCallSiteClass} [&_.uc-dd-menu]:min-w-[104px]`}>
              <CustomDropdown
                ariaLabel="건물 그룹"
                value={groupId}
                options={groupOptions}
                compact
                onChange={setGroupId}
              />
            </div>
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
              <tr className="border-b border-line">
                <th className="px-[11px] py-[11px]">코드</th>
                <th className="px-[11px] py-[11px]">건물명</th>
                <th className="px-[11px] py-[11px]">주소</th>
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
                    className={`h-[41px] cursor-pointer border-b border-line2 ${selected ? "bg-[#e2f5f1] font-bold" : "hover:bg-blue-t2"}`}
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
            <p className="px-[18px] py-[30px] text-center text-[13px] text-t3">조건에 맞는 건물이 없어요.</p>
          )}
          {loading && <p role="status" aria-label="건물 목록 불러오는 중" className="px-[18px] py-[30px] text-center text-[13px] text-t3">건물을 불러오는 중이에요.</p>}
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
