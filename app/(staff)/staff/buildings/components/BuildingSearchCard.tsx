"use client";
import { FilterIcon, SearchIcon } from "@/components/icons";

/** Figma 673:39836 — 건물 검색 카드(필터 버튼 + 검색 입력 + 검색 버튼). */
export function BuildingSearchCard({
  value,
  onChange,
  onSearch,
}: {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
}) {
  return (
    <form
      className="flex items-center gap-[10px] rounded-2xl border border-line bg-surface px-[17px] py-[15px]"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
    >
      <button
        type="button"
        aria-label="필터"
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] border border-line bg-surface text-t3 hover:bg-bg"
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
  );
}
