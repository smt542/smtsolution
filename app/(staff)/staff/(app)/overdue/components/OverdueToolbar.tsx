import Image from "next/image";
import { useState } from "react";
import { CustomDropdown } from "@/components/common";
import type { OverdueBuilding, OverdueScope } from "@/hooks/reactquery/overdue";

// 정본 `#ovYear` 와 같은 최근 4개년(올해부터 3년 전까지).
const YEAR_OPTIONS = Array.from({ length: 4 }, (_, index) => {
  const year = new Date().getFullYear() - index;
  return { value: String(year), label: `${year}년` };
});
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: `${index + 1}월`,
}));

// 정본 `.uc-dd-menu{padding:5px}`. 공용 CustomDropdown 의 기본값은 accounts 정본(6px)이라
// 이 화면에서만 덮는다 — 1px 차이가 메뉴 높이 2px·옵션 좌표 1px 로 누적된다.
const DD_MENU_PADDING = "[&_.uc-dd-menu]:p-[5px]";

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

function Segment({
  active,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      className={`rounded-[7px] px-[11px] py-[5px] text-[12px] font-bold leading-[14px] transition-colors ${
        active ? "bg-white text-t1" : "text-t3 hover:text-t2"
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
      <Image
        src="/icons/overdue/search.svg"
        alt=""
        width={15}
        height={15}
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
  return (
    <section
      aria-label="미납 조회 조건"
      // 정본 `.ov-bar`. `overflow:visible` + `z-20` 은 드롭다운 메뉴가 패널에 잘리지
      // 않게 하려는 것이라 임의로 `overflow-hidden` 으로 바꾸면 메뉴가 사라진다.
      className="relative z-20 flex flex-wrap items-center gap-[8px] overflow-visible rounded-t-[16px] border-b border-line2 bg-white px-[16px] py-[13px]"
    >
      {/* 정본 `#ovYear .uc-dd-menu{min-width:104px}` — 기본값(96px)보다 넓다. */}
      <div className={`${DD_MENU_PADDING} [&_.uc-dd-menu]:min-w-[104px]`}>
        <CustomDropdown
          ariaLabel="조회 년도"
          value={targetYear === null ? "" : String(targetYear)}
          options={YEAR_OPTIONS}
          placeholder="년도"
          size="compact"
          disabled={disabled}
          onChange={(value) => onPeriodChange(Number(value), targetMonth)}
        />
      </div>

      <div className={DD_MENU_PADDING}>
        <CustomDropdown
          ariaLabel="조회 월"
          value={targetMonth === null ? "" : String(targetMonth)}
          options={MONTH_OPTIONS}
          placeholder="월"
          size="compact"
          disabled={disabled}
          onChange={(value) => onPeriodChange(targetYear, Number(value))}
        />
      </div>

      <span className="shrink-0 text-[12px] font-bold leading-[normal] text-t3">까지</span>

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

      <div className="flex-1" />

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
        <Image src="/icons/overdue/print.svg" alt="" width={16} height={16} className="size-[16px]" />
        출력
      </button>
    </section>
  );
}
