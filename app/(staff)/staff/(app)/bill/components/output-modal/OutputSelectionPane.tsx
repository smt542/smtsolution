"use client";

import Image from "next/image";
import type { BillTarget } from "@/hooks/reactquery/bill";
import type { BillBuilding } from "../../types";
import type { OutputDocumentType } from "../../types";
import { SelectionCheck, SmallSelect } from "./OutputModalPrimitives";

interface BuildingTargets {
  building: BillBuilding;
  targets: BillTarget[];
}

interface OutputSelectionPaneProps {
  type: Exclude<OutputDocumentType, "autoDebit">;
  year: number;
  month: number;
  years: number[];
  months: number[];
  search: string;
  buildings: BillBuilding[];
  selectedBuildingIds: number[];
  targetsByBuilding: BuildingTargets[];
  selectedUnitIds: number[];
  onYearChange: (value: number) => void;
  onMonthChange: (value: number) => void;
  onSearchChange: (value: string) => void;
  onToggleBuilding: (buildingId: number) => void;
  onToggleAllBuildings: () => void;
  onToggleUnit: (unitId: number) => void;
  onToggleAllUnits: () => void;
}

function displayName(target: BillTarget) {
  return target.payerName || target.tenantName || "-";
}

function displayUnitNo(unitNo: string) {
  return unitNo.endsWith("호") ? unitNo : `${unitNo}호`;
}

export function OutputSelectionPane({
  type,
  year,
  month,
  years,
  months,
  search,
  buildings,
  selectedBuildingIds,
  targetsByBuilding,
  selectedUnitIds,
  onYearChange,
  onMonthChange,
  onSearchChange,
  onToggleBuilding,
  onToggleAllBuildings,
  onToggleUnit,
  onToggleAllUnits,
}: OutputSelectionPaneProps) {
  const hasUnitTable = type === "giro" || type === "fax";
  const targets = targetsByBuilding.flatMap(({ targets: buildingTargets }) => buildingTargets);
  const allBuildingsSelected = buildings.length > 0 && buildings.every((building) => selectedBuildingIds.includes(building.id));
  const allUnitsSelected = targets.length > 0 && targets.every((target) => selectedUnitIds.includes(target.unitId));

  return (
    <aside className="flex min-h-0 flex-col border-r border-[#e8ebee] bg-white">
      <div className="h-[100px] shrink-0 border-b border-[#e8ebee] px-[12px] pt-[13px]">
        <div className="flex items-center gap-[6px]">
          <SmallSelect ariaLabel="출력 연도" value={String(year)} onChange={(event) => onYearChange(Number(event.target.value))} className="w-[88px]">
            {years.map((value) => <option key={value} value={value}>{value}년</option>)}
          </SmallSelect>
          <SmallSelect ariaLabel="월분" value={String(month)} onChange={(event) => onMonthChange(Number(event.target.value))} className="w-[74px]">
            {months.map((value) => <option key={value} value={value}>{value}월분</option>)}
          </SmallSelect>
          <SmallSelect ariaLabel="건물 그룹" value="all" onChange={() => undefined} className="w-[88px]">
            <option value="all">그룹 전체</option>
          </SmallSelect>
        </div>

        <label className="relative mt-[8px] block h-[34px]">
          <Image
            aria-hidden="true"
            src="/figma-assets/bill/search.svg"
            alt=""
            width={14}
            height={14}
            className="absolute left-[10px] top-1/2 size-[14px] -translate-y-1/2"
          />
          <input
            aria-label="건물 검색"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="코드·건물명·주소 검색"
            className="h-full w-full rounded-[9px] border border-[#e8ebee] bg-white pl-[31px] pr-[10px] text-[11.5px] text-[#333d4b] outline-none placeholder:text-[#b0b8c1] focus:border-[#14a497] focus:ring-[3px] focus:ring-[#e2f5f1]"
          />
        </label>
      </div>

      <div className={`min-h-0 ${hasUnitTable ? "h-[211px] shrink-0" : "flex-1"} overflow-hidden border-b border-[#e8ebee]`}>
        <div className="grid h-[39px] grid-cols-[34px_65px_104px_minmax(0,1fr)] items-center border-b border-[#e8ebee] bg-[#f8f9fa] text-[10.5px] font-bold text-[#6b7684]">
          <span className="flex justify-center"><SelectionCheck ariaLabel="건물 전체 선택" checked={allBuildingsSelected} onChange={onToggleAllBuildings} /></span>
          <span>코드</span>
          <span>건물명</span>
          <span>주소</span>
        </div>
        <div className="h-[calc(100%-39px)] overflow-y-auto">
          {buildings.map((building) => {
            const selected = selectedBuildingIds.includes(building.id);
            return (
              <div
                key={building.id}
                onClick={() => onToggleBuilding(building.id)}
                className={`grid h-[42px] w-full grid-cols-[34px_65px_104px_minmax(0,1fr)] items-center border-b border-[#f1f3f5] text-left text-[10.5px] transition hover:bg-[#f8fbfb] ${selected ? "bg-[#f4fbfa]" : "bg-white"}`}
              >
                <span className="flex justify-center"><SelectionCheck ariaLabel={`${building.name} 선택`} checked={selected} onChange={() => onToggleBuilding(building.id)} /></span>
                <span className="truncate pr-1 font-semibold text-[#4e5968]">{building.code}</span>
                <span className="truncate pr-1 font-bold text-[#333d4b]">{building.name}</span>
                <span className="truncate pr-2 text-[#8b95a1]">{building.address || "-"}</span>
              </div>
            );
          })}
          {buildings.length === 0 && <p className="py-8 text-center text-[11px] text-[#8b95a1]">검색 결과가 없습니다.</p>}
        </div>
      </div>

      {hasUnitTable && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="grid h-[39px] grid-cols-[34px_47px_76px_91px_49px] items-center border-b border-[#e8ebee] bg-[#f8f9fa] text-[10.5px] font-bold text-[#6b7684]">
            <span className="flex justify-center"><SelectionCheck ariaLabel="호수 전체 선택" checked={allUnitsSelected} disabled={targets.length === 0} onChange={onToggleAllUnits} /></span>
            <span>호수</span>
            <span>세대주</span>
            <span>핸드폰</span>
            <span>이체</span>
          </div>
          <div className="h-[calc(100%-39px)] overflow-y-auto">
            {targets.map((target) => {
              const selected = selectedUnitIds.includes(target.unitId);
              const disabled = type === "fax" && !target.faxNumber;
              return (
                <div
                  key={target.unitId}
                  onClick={() => { if (!disabled) onToggleUnit(target.unitId); }}
                  className={`grid h-[42px] w-full grid-cols-[34px_47px_76px_91px_49px] items-center border-b border-[#f1f3f5] text-left text-[10.5px] transition hover:bg-[#f8fbfb] ${disabled ? "cursor-not-allowed opacity-45" : ""} ${selected ? "bg-[#f4fbfa]" : "bg-white"}`}
                >
                  <span className="flex justify-center"><SelectionCheck ariaLabel={`${targetsByBuilding.find(({ targets: values }) => values.some(({ unitId }) => unitId === target.unitId))?.building.name ?? "건물"} · ${target.unitNo}호 · ${displayName(target)}`} checked={selected} disabled={disabled} onChange={() => onToggleUnit(target.unitId)} /></span>
                  <span className="truncate font-bold text-[#333d4b]">{displayUnitNo(target.unitNo)}</span>
                  <span className="truncate pr-1 text-[#4e5968]">{displayName(target)}</span>
                  <span className="truncate pr-1 text-[#8b95a1]">{target.phone || "-"}</span>
                  <span className="truncate text-[#4e5968]">{target.autoDebit ? "자동" : "일반"}</span>
                </div>
              );
            })}
            {targets.length === 0 && <p className="py-8 text-center text-[11px] text-[#8b95a1]">{selectedBuildingIds.length === 0 ? "건물을 선택하면 호수가 표시돼요" : "확정된 세대가 없습니다."}</p>}
          </div>
        </div>
      )}
    </aside>
  );
}
