"use client";
import { useState, type ReactNode } from "react";

export type MeterKind = "" | "수도" | "전기" | "가스" | "공용전기";

/** 건물 목록 필터 상태(프로토타입 building-list 필터 패널). */
export interface BuildingFilterState {
  regSort: "desc" | "asc"; // 등록일 최신순/오래된 순
  managerUserId: string | null; // 사무 담당자
  meterUserId: string | null; // 현장 관리자
  cleaningUserId: string | null; // 청소 담당자
  meterKind: MeterKind; // 검침일 기준
  meterDir: "asc" | "desc"; // 빠른 순/늦은 순
}

export const initialBuildingFilter: BuildingFilterState = {
  regSort: "desc",
  managerUserId: null,
  meterUserId: null,
  cleaningUserId: null,
  meterKind: "",
  meterDir: "asc",
};

export function isFilterActive(f: BuildingFilterState): boolean {
  return (
    f.regSort !== "desc" ||
    f.managerUserId !== null ||
    f.meterUserId !== null ||
    f.cleaningUserId !== null ||
    f.meterKind !== ""
  );
}

interface StaffOption {
  id: string;
  name: string;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-[13px] py-[6px] text-[12.5px] font-bold leading-[normal] transition-colors ${
        active ? "border-teal-t bg-teal-t text-teal" : "border-transparent bg-bg text-t2 hover:bg-[#e4e8ec]"
      }`}
    >
      {children}
    </button>
  );
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-[12px]">
      <div className="w-[82px] shrink-0 text-[12.5px] font-bold leading-[normal] text-t2">{label}</div>
      <div className="flex flex-wrap items-center gap-[7px]">{children}</div>
    </div>
  );
}

/** Figma 673:39836 — 건물 검색 카드(필터 버튼 + 검색 입력 + 검색 버튼) + 확장 필터 패널. */
export function BuildingSearchCard({
  value,
  onChange,
  onSearch,
  filter,
  onFilterChange,
  staff,
}: {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
  filter: BuildingFilterState;
  onFilterChange: (next: BuildingFilterState) => void;
  staff: StaffOption[];
}) {
  const [open, setOpen] = useState(false);
  const patch = (p: Partial<BuildingFilterState>) => onFilterChange({ ...filter, ...p });

  const staffChips = (selected: string | null, key: "managerUserId" | "meterUserId" | "cleaningUserId") => (
    <>
      <Chip active={selected === null} onClick={() => patch({ [key]: null } as Partial<BuildingFilterState>)}>
        전체
      </Chip>
      {staff.map((s) => (
        <Chip key={s.id} active={selected === s.id} onClick={() => patch({ [key]: s.id } as Partial<BuildingFilterState>)}>
          {s.name}
        </Chip>
      ))}
    </>
  );

  const METER_KINDS: MeterKind[] = ["수도", "전기", "가스", "공용전기"];

  return (
    <div className="min-h-[69px] shrink-0 rounded-2xl border border-line bg-surface px-[16px] py-[14px] shadow-card">
      <form
        className="flex items-center gap-[10px]"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch();
        }}
      >
        <button
          type="button"
          aria-label="필터"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] border transition-colors ${
            open || isFilterActive(filter)
              ? "border-teal-t bg-teal-t text-teal-d"
              : "border-line bg-surface text-t2 hover:bg-bg"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M4 5h16M7 12h10M10 19h4" />
          </svg>
        </button>
        <div className="relative flex-1">
          <span aria-hidden="true" className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2 text-t3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-4 w-4"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" />
            </svg>
          </span>
          <input
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="건물명·주소 검색"
            className="h-[38px] w-full rounded-[11px] border border-line bg-surface pl-[34px] pr-[12px] text-[14px] font-semibold leading-[normal] text-t1 placeholder:font-semibold placeholder:text-[#757575] focus:border-teal focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-[38px] shrink-0 items-center rounded-[11px] border border-transparent bg-teal px-[15px] text-[13.5px] font-bold leading-[normal] text-white shadow-[0_6px_14px_-4px_rgba(20,164,151,0.5)] hover:bg-teal-d"
        >
          검색
        </button>
      </form>

      {/* 정본 .flt-panel — 닫혀도 그려 두고 max-height·opacity·margin-top·padding-top을 전환한다(윗선 색은 즉시 바뀜). */}
      <div
        inert={!open}
        className={`flex flex-col gap-[11px] overflow-hidden border-t [transition:max-height_.3s_ease,opacity_.25s_ease,margin-top_.3s_ease,padding-top_.3s_ease] ${
          open ? "mt-[13px] max-h-[400px] border-line2 pt-[13px] opacity-100" : "mt-0 max-h-0 border-transparent pt-0 opacity-0"
        }`}
      >
        <ChipGroup label="등록일">
          <Chip active={filter.regSort === "desc"} onClick={() => patch({ regSort: "desc" })}>
            최신순
          </Chip>
          <Chip active={filter.regSort === "asc"} onClick={() => patch({ regSort: "asc" })}>
            오래된 순
          </Chip>
        </ChipGroup>

        <ChipGroup label="사무 담당자">{staffChips(filter.managerUserId, "managerUserId")}</ChipGroup>
        <ChipGroup label="현장 관리자">{staffChips(filter.meterUserId, "meterUserId")}</ChipGroup>

        <ChipGroup label="검침일">
          <Chip active={filter.meterKind === ""} onClick={() => patch({ meterKind: "" })}>
            기준 없음
          </Chip>
          {METER_KINDS.map((k) => (
            <Chip key={k} active={filter.meterKind === k} onClick={() => patch({ meterKind: k })}>
              {k}
            </Chip>
          ))}
          {filter.meterKind !== "" && (
            <div className="ml-[8px] flex items-center gap-[7px] border-l border-line2 pl-[12px]">
              <Chip active={filter.meterDir === "asc"} onClick={() => patch({ meterDir: "asc" })}>
                빠른 순
              </Chip>
              <Chip active={filter.meterDir === "desc"} onClick={() => patch({ meterDir: "desc" })}>
                늦은 순
              </Chip>
            </div>
          )}
        </ChipGroup>

        <ChipGroup label="청소 담당자">{staffChips(filter.cleaningUserId, "cleaningUserId")}</ChipGroup>
      </div>
    </div>
  );
}
