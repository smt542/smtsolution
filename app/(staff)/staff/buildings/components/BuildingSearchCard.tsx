"use client";
import { useState, type ReactNode } from "react";
import { FilterIcon, SearchIcon } from "@/components/icons";

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
      className={`rounded-[9px] px-[11px] py-[6px] text-[12.5px] font-bold transition-colors ${
        active ? "border border-teal-t bg-teal-t text-teal-d" : "border border-transparent bg-bg text-t2 hover:bg-line2"
      }`}
    >
      {children}
    </button>
  );
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[8px]">
      <div className="text-[12px] font-bold text-t3">{label}</div>
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
    <div className="rounded-2xl border border-line bg-surface px-[17px] py-[15px]">
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
              : "border-line bg-surface text-t3 hover:bg-bg"
          }`}
        >
          <FilterIcon className="h-4 w-4" />
        </button>
        <div className="relative flex-1">
          <span aria-hidden="true" className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2 text-t3">
            <SearchIcon className="h-4 w-4" />
          </span>
          <input
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="건물명·주소 검색"
            className="h-[38px] w-full rounded-[11px] border border-line bg-surface pl-[34px] pr-[12px] text-[14px] font-semibold text-t1 placeholder:font-semibold placeholder:text-[#757575] focus:border-teal focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-[38px] shrink-0 items-center rounded-[11px] bg-teal px-[15px] text-[13.5px] font-bold text-white shadow-[0_6px_7px_rgba(20,164,151,0.5)] hover:bg-teal-d"
        >
          검색
        </button>
      </form>

      {open && (
        <div className="mt-[13px] flex flex-col gap-[16px] border-t border-line2 pt-[13px]">
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
      )}
    </div>
  );
}
