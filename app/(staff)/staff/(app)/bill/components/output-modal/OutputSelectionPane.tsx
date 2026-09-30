"use client";

import type { BillTarget } from "@/hooks/reactquery/bill";
import { displayUnitNo } from "@/lib/bill/document";
import { transferMethodLabel } from "@/lib/bill/transferMethod";
import { BUILDING_GROUP_TYPES } from "@/lib/buildings/groupType";
import type { BillBuilding } from "../../types";
import type { OutputDocumentType } from "../../types";
import { FilterDropdown, SelectionCheck } from "./OutputModalPrimitives";

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
  group: string;
  search: string;
  buildings: BillBuilding[];
  selectedBuildingIds: number[];
  targetsByBuilding: BuildingTargets[];
  selectedUnitIds: number[];
  onYearChange: (value: number) => void;
  onMonthChange: (value: number) => void;
  onGroupChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onToggleBuilding: (buildingId: number) => void;
  onToggleAllBuildings: () => void;
  onToggleUnit: (unitId: number) => void;
  onToggleUnits: (unitIds: number[]) => void;
  onToggleAllUnits: () => void;
}

// 정본 bill-publish `#adjGrp2`: '그룹 전체' + 1그룹~5그룹(건물 고지서 부과 그룹 유형).
const GROUP_OPTIONS = [
  { value: "", label: "그룹 전체" },
  ...BUILDING_GROUP_TYPES.map((value) => ({ value, label: `${value}그룹` })),
];

// 정본 `.hf-tbl`: 머리 12px/700 t3·#FBFCFD(스크롤해도 고정), 칸 13.5px t1·아래 선 line2, 마지막 행은 선 없음.
const TH = "sticky top-0 z-[2] border-b border-line bg-[#FBFCFD] py-[11px] text-[12px] font-bold whitespace-nowrap text-t3";
const TD = "border-b border-line2 py-3 text-[13.5px] whitespace-nowrap text-t1";
const ROW = "cursor-pointer [&:hover>td]:bg-row-hover [&:last-child>td]:border-b-0";
// 정본 `.giro-unit-empty`
const EMPTY = "px-3.5 py-[22px] text-center text-[12.5px] font-medium text-t3";

function displayName(target: BillTarget) {
  return target.payerName || target.tenantName || "-";
}

export function OutputSelectionPane({
  type,
  year,
  month,
  years,
  months,
  group,
  search,
  buildings,
  selectedBuildingIds,
  targetsByBuilding,
  selectedUnitIds,
  onYearChange,
  onMonthChange,
  onGroupChange,
  onSearchChange,
  onToggleBuilding,
  onToggleAllBuildings,
  onToggleUnit,
  onToggleUnits,
  onToggleAllUnits,
}: OutputSelectionPaneProps) {
  const hasUnitTable = type === "giro" || type === "fax";
  const isSelectable = (target: BillTarget) => type !== "fax" || Boolean(target.faxNumber);
  const groups = targetsByBuilding.filter(({ targets }) => targets.length > 0);
  const selectableTargets = groups.flatMap(({ targets }) => targets.filter(isSelectable));
  const allBuildingsSelected = buildings.length > 0 && buildings.every((building) => selectedBuildingIds.includes(building.id));
  const allUnitsSelected = selectableTargets.length > 0 && selectableTargets.every((target) => selectedUnitIds.includes(target.unitId));
  // 정본 drawUnits: 호수가 있는 건물이 둘 이상이면 건물마다 묶음 머리(건물 단위 선택·선택 수)를 단다.
  const showGroupRows = groups.length > 1;

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-line bg-white leading-[normal]">
      <div className="flex flex-none flex-col gap-[9px] border-b border-line2 p-3">
        <div className="flex items-center gap-1.5">
          <FilterDropdown ariaLabel="출력 연도" menuMinWidth={104} value={String(year)} options={years.map((value) => ({ value: String(value), label: `${value}년` }))} onChange={(value) => onYearChange(Number(value))} />
          <FilterDropdown ariaLabel="월분" menuMinWidth={112} value={String(month)} options={months.map((value) => ({ value: String(value), label: `${value}월분` }))} onChange={(value) => onMonthChange(Number(value))} />
          <FilterDropdown ariaLabel="건물 그룹" menuMinWidth={118} value={group} options={GROUP_OPTIONS} onChange={onGroupChange} />
        </div>

        <label className="relative block">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            className="pointer-events-none absolute left-[11px] top-1/2 size-[15px] -translate-y-1/2 text-t3"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
          {/* 정본 #adjSrch 는 placeholder 색을 따로 주지 않아 브라우저 기본(#757575)이다. */}
          <input
            aria-label="건물 검색"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="코드·건물명·주소 검색"
            className="h-[34px] w-full rounded-[9px] border border-line bg-white pl-[31px] pr-[11px] text-[13px] font-semibold text-t1 outline-none placeholder:text-[#757575]"
          />
        </label>
      </div>

      <div className="min-h-[72px] flex-1 basis-0 overflow-auto">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              <th className={`${TH} w-[34px] pl-3 pr-0 text-left`}>
                <SelectionCheck ariaLabel="건물 전체 선택" checked={allBuildingsSelected} onChange={onToggleAllBuildings} />
              </th>
              <th className={`${TH} w-[64px] px-2.5 text-left`}>코드</th>
              <th className={`${TH} w-[104px] px-2.5 text-left`}>건물명</th>
              <th className={`${TH} px-2.5 text-left`}>주소</th>
            </tr>
          </thead>
          <tbody>
            {buildings.map((building) => {
              const selected = selectedBuildingIds.includes(building.id);
              return (
                <tr key={building.id} aria-selected={selected} onClick={() => onToggleBuilding(building.id)} className={ROW}>
                  <td className={`${TD} pl-3 pr-0`}>
                    <SelectionCheck ariaLabel={`${building.name} 선택`} checked={selected} onChange={() => onToggleBuilding(building.id)} />
                  </td>
                  <td className={`${TD} truncate px-2.5 tabular-nums`}>{building.code}</td>
                  <td className={`${TD} truncate px-2.5 font-semibold`}>{building.name}</td>
                  <td className={`${TD} truncate px-2.5`}>{building.address || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {buildings.length === 0 && <p className={EMPTY}>검색 결과가 없습니다.</p>}
      </div>

      {hasUnitTable && (
        <div className="min-h-[72px] flex-1 basis-0 overflow-auto border-t border-line">
          {groups.length === 0 ? (
            <p className={EMPTY}>{selectedBuildingIds.length === 0 ? "건물을 선택하면 호수가 표시돼요" : "확정된 세대가 없습니다."}</p>
          ) : (
            // 정본 `#adjUnits` 칸은 padding 16px이고 말줄임이 없다 — 긴 글자는 칸 경계에서만 자른다.
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr>
                  <th className={`${TH} w-[34px] px-4 text-left`}>
                    <SelectionCheck ariaLabel="호수 전체 선택" checked={allUnitsSelected} disabled={selectableTargets.length === 0} onChange={onToggleAllUnits} />
                  </th>
                  <th className={`${TH} w-[64px] px-4 text-left`}>호수</th>
                  <th className={`${TH} w-[62px] px-4 text-left`}>세대주</th>
                  <th className={`${TH} px-4 text-left`}>핸드폰</th>
                  <th className={`${TH} w-[46px] px-4 text-right`}>이체</th>
                </tr>
              </thead>
              <tbody>
                {groups.flatMap(({ building, targets }) => {
                  const groupIds = targets.filter(isSelectable).map((target) => target.unitId);
                  const groupSelected = targets.filter((target) => selectedUnitIds.includes(target.unitId)).length;
                  const groupChecked = groupIds.length > 0 && groupIds.every((unitId) => selectedUnitIds.includes(unitId));
                  const groupRow = showGroupRows ? (
                    <tr
                      key={`group-${building.id}`}
                      onClick={() => onToggleUnits(groupIds)}
                      className="cursor-pointer [&>td]:border-t [&>td]:border-t-line [&>td]:bg-bg [&>td]:font-extrabold [&:hover>td]:bg-[#EBEEF1]"
                    >
                      <td className={`${TD} overflow-hidden px-4`}>
                        <SelectionCheck ariaLabel={`${building.name} 호수 전체 선택`} checked={groupChecked} disabled={groupIds.length === 0} onChange={() => onToggleUnits(groupIds)} />
                      </td>
                      <td colSpan={3} className={`${TD} overflow-hidden px-4`}>{building.code} {building.name}</td>
                      <td className={`${TD} overflow-hidden px-4 text-right tabular-nums`}>{groupSelected}/{targets.length}</td>
                    </tr>
                  ) : null;
                  const unitRows = targets.map((target) => {
                    const selected = selectedUnitIds.includes(target.unitId);
                    const disabled = !isSelectable(target);
                    return (
                      <tr
                        key={target.unitId}
                        aria-selected={selected}
                        onClick={() => { if (!disabled) onToggleUnit(target.unitId); }}
                        className={`${ROW} ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
                      >
                        <td className={`${TD} overflow-hidden px-4`}>
                          <SelectionCheck ariaLabel={`${building.name} · ${displayUnitNo(target.unitNo)} · ${displayName(target)}`} checked={selected} disabled={disabled} onChange={() => onToggleUnit(target.unitId)} />
                        </td>
                        <td className={`${TD} overflow-hidden px-4 font-bold`}>{displayUnitNo(target.unitNo)}</td>
                        <td className={`${TD} overflow-hidden px-4`}>{displayName(target)}</td>
                        <td className={`${TD} overflow-hidden px-4 tabular-nums`}>{target.phone || "-"}</td>
                        <td className={`${TD} overflow-hidden px-4 text-right`}>{transferMethodLabel(target.transferMethod)}</td>
                      </tr>
                    );
                  });
                  return groupRow ? [groupRow, ...unitRows] : unitRows;
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </aside>
  );
}
