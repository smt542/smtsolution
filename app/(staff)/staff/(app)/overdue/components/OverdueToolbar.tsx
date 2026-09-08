/* eslint-disable @next/next/no-img-element -- Figma SVG assets are served unchanged from public. */

import { useState } from "react";
import type { OverdueBuilding, OverdueScope } from "@/hooks/reactquery/overdue";

const YEAR_OPTIONS = Array.from({ length: 8 }, (_, index) =>
  new Date().getFullYear() - index,
);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

interface OverdueToolbarProps {
  buildings: OverdueBuilding[];
  selectedBuildingId: number | null;
  onBuildingChange: (buildingId: number | null) => void;
  targetYear: number | null;
  targetMonth: number | null;
  scope: OverdueScope;
  onPeriodChange: (year: number | null, month: number | null) => void;
  onScopeChange: (scope: OverdueScope) => void;
  debtFilterEnabled: boolean;
  onToggleDebtFilter: () => void;
  onSend: () => void;
  onExport: () => void;
  canSend: boolean;
  canExport: boolean;
  disabled?: boolean;
}

function DropdownIcon() {
  return (
    <img
      src="/icons/overdue/chevron.svg"
      alt=""
      className="pointer-events-none absolute right-[10px] top-1/2 size-[15px] -translate-y-1/2"
    />
  );
}

function Segment({
  active,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      className={`rounded-[7px] px-[11px] py-[5px] text-[12px] font-bold leading-[14px] transition-colors ${
        active
          ? "bg-white text-t1 shadow-[0_1px_2px_rgba(23,31,40,0.08)]"
          : "text-t3 hover:text-t2"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

function BuildingSearch({
  buildings,
  selectedBuildingId,
  onBuildingChange,
  disabled,
}: Pick<
  OverdueToolbarProps,
  "buildings" | "selectedBuildingId" | "onBuildingChange" | "disabled"
>) {
  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId);
  const [query, setQuery] = useState(selectedBuilding?.name ?? "");

  const findBuilding = (value: string) => buildings.find(
    (building) => building.name.trim().toLocaleLowerCase("ko-KR") === value.trim().toLocaleLowerCase("ko-KR"),
  );

  return (
    <label className="relative h-[38px] w-[200px] shrink-0">
      <span className="sr-only">건물 선택</span>
      <img
        src="/icons/overdue/search.svg"
        alt=""
        className="pointer-events-none absolute left-[11px] top-[11.5px] z-10 size-[15px]"
      />
      <input
        id="overdue-building"
        aria-label="건물 선택"
        list="overdue-building-options"
        value={query}
        placeholder="건물명 검색"
        disabled={disabled}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          const matchedBuilding = findBuilding(nextQuery);
          if (matchedBuilding) onBuildingChange(matchedBuilding.id);
        }}
        onBlur={() => {
          const matchedBuilding = findBuilding(query);
          if (matchedBuilding) {
            setQuery(matchedBuilding.name);
            onBuildingChange(matchedBuilding.id);
          } else {
            setQuery("");
            onBuildingChange(null);
          }
        }}
        className="h-[38px] w-full rounded-[10px] border border-line bg-white pl-[32px] pr-[11px] text-[13px] font-semibold text-t1 outline-none transition placeholder:text-t3 focus:border-teal disabled:opacity-60"
      />
      <datalist id="overdue-building-options">
        {buildings.map((building) => (
          <option key={building.id} value={building.name} />
        ))}
      </datalist>
    </label>
  );
}

export function OverdueToolbar({
  buildings,
  selectedBuildingId,
  onBuildingChange,
  targetYear,
  targetMonth,
  scope,
  onPeriodChange,
  onScopeChange,
  debtFilterEnabled,
  onToggleDebtFilter,
  onSend,
  onExport,
  canSend,
  canExport,
  disabled = false,
}: OverdueToolbarProps) {
  const periodValue =
    targetYear !== null && targetMonth !== null
      ? `${targetYear}-${String(targetMonth).padStart(2, "0")}`
      : "";

  return (
    <section
      aria-label="미납 조회 조건"
      className="flex min-h-[65px] flex-wrap items-center gap-[8px] border-b border-line2 bg-white px-[16px] py-[13px] lg:flex-nowrap"
    >
      <label className={`relative h-[32px] shrink-0 ${targetYear === null ? "w-[68px]" : "w-[89px]"}`}>
        <span className="sr-only">조회 년도</span>
        <select
          aria-label="조회 년도"
          value={targetYear ?? ""}
          disabled={disabled}
          onChange={(event) =>
            onPeriodChange(event.target.value ? Number(event.target.value) : null, targetMonth)
          }
          className="h-[32px] w-full appearance-none rounded-[9px] border border-line bg-white pl-[11px] pr-[30px] text-[13px] font-bold tracking-[-0.13px] text-t1 outline-none transition focus:border-teal"
        >
          <option value="">년도</option>
          {YEAR_OPTIONS.map((year) => (
            <option key={year} value={year}>{year}년</option>
          ))}
        </select>
        <DropdownIcon />
      </label>

      <label className={`relative h-[32px] shrink-0 ${targetMonth === null ? "w-[56px]" : "w-[64px]"}`}>
        <span className="sr-only">조회 월</span>
        <select
          aria-label="조회 월"
          value={targetMonth ?? ""}
          disabled={disabled}
          onChange={(event) =>
            onPeriodChange(targetYear, event.target.value ? Number(event.target.value) : null)
          }
          className="h-[32px] w-full appearance-none rounded-[9px] border border-line bg-white pl-[11px] pr-[27px] text-[13px] font-bold tracking-[-0.13px] text-t1 outline-none transition focus:border-teal"
        >
          <option value="">월</option>
          {MONTH_OPTIONS.map((month) => (
            <option key={month} value={month}>{month}월</option>
          ))}
        </select>
        <DropdownIcon />
      </label>

      <input
        aria-label="조회 기간"
        type="month"
        value={periodValue}
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => {
          const [year, month] = event.target.value.split("-").map(Number);
          onPeriodChange(Number.isInteger(year) ? year : null, Number.isInteger(month) ? month : null);
        }}
      />

      <span className="shrink-0 text-[12px] font-bold text-t3">까지</span>

      <div className="flex shrink-0 gap-[2px] rounded-[9px] bg-[#edf0f3] p-[3px]">
        <Segment
          active={!debtFilterEnabled}
          aria-label="전체 미납 보기"
          onClick={debtFilterEnabled ? onToggleDebtFilter : undefined}
        >
          전체
        </Segment>
        <Segment
          active={debtFilterEnabled}
          aria-label="채권 관리 필터"
          aria-pressed={debtFilterEnabled}
          onClick={!debtFilterEnabled ? onToggleDebtFilter : undefined}
        >
          독촉 대상
        </Segment>
      </div>

      <div className="flex shrink-0 gap-[2px] rounded-[9px] bg-[#edf0f3] p-[3px]">
        <Segment active={scope === "all"} onClick={() => onScopeChange("all")}>전체</Segment>
        <Segment active={scope === "current"} onClick={() => onScopeChange("current")}>당계</Segment>
      </div>

      <div className="min-w-[12px] flex-1" />

      <BuildingSearch
        key={selectedBuildingId ?? "unselected"}
        buildings={buildings}
        selectedBuildingId={selectedBuildingId}
        onBuildingChange={onBuildingChange}
        disabled={disabled}
      />

      <span aria-hidden="true" className="mx-[2px] h-[22px] w-px shrink-0 bg-line" />

      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        className="h-[34px] shrink-0 rounded-[8px] border border-line bg-white px-[14px] text-[13px] font-bold text-t2 transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-45"
      >
        독촉 문자 발송
      </button>
      <button
        type="button"
        onClick={onExport}
        disabled={!canExport}
        aria-label="미납대장 출력"
        className="flex h-[34px] shrink-0 items-center justify-center gap-[7px] rounded-[11px] bg-teal px-[14px] text-[13px] font-bold tracking-[-0.13px] text-white transition hover:bg-teal-d disabled:cursor-not-allowed disabled:opacity-45"
      >
        <img src="/icons/overdue/print.svg" alt="" className="size-[16px]" />
        출력
      </button>
    </section>
  );
}
