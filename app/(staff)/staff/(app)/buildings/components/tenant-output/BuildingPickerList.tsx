"use client";
import type { Building } from "@/hooks/reactquery/buildings";

interface BuildingPickerListProps {
  buildings: Building[];
  search: string;
  onSearch: (value: string) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

/** 좌측 건물 선택 패널 — 코드·건물명·주소 검색 + 단일 선택 리스트. */
export function BuildingPickerList({
  buildings,
  search,
  onSearch,
  selectedId,
  onSelect,
}: BuildingPickerListProps) {
  const keyword = search.trim().toLocaleLowerCase("ko-KR");
  const visible = keyword
    ? buildings.filter((building) =>
        `${building.code} ${building.name} ${building.address ?? ""}`
          .toLocaleLowerCase("ko-KR")
          .includes(keyword),
      )
    : buildings;

  return (
    <div className="flex w-[340px] shrink-0 flex-col border-r border-line bg-[#fbfcfd]">
      <div className="relative h-[69px] shrink-0 border-b border-line2">
        {/* 정본 `.pm-search svg` — 입력칸도 absolute라 z-index 없이는 입력칸 흰 배경에 가려진다. */}
        <span aria-hidden className="pointer-events-none absolute left-[28px] top-[26px] z-[1] text-t3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
        </span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="코드·건물명·주소 검색"
          aria-label="건물 검색"
          className="absolute left-[16px] top-[14px] h-[40px] w-[307px] rounded-[11px] border border-line bg-white pl-[34px] pr-[12px] text-[13.5px] font-semibold text-t1 placeholder:text-[#757575] focus:border-brand focus:outline-none"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-[8px]">
        {visible.length === 0 ? (
          <p className="p-6 text-center text-[12.5px] text-t3">검색 결과가 없습니다.</p>
        ) : (
          visible.map((building) => {
            const active = building.id === selectedId;
            return (
              <button
                type="button"
                key={building.id}
                onClick={() => onSelect(building.id)}
                aria-pressed={active}
                className={`flex w-full flex-col items-start rounded-[12px] border px-[14px] py-[12px] text-left transition duration-100 ${
                  active ? "border-teal bg-teal-t" : "border-transparent hover:border-line hover:bg-white"
                }`}
              >
                <span className="flex items-center gap-[8px]">
                  <span
                    className={`rounded-[6px] border bg-white px-[7px] py-px text-[11px] font-bold text-t3 ${
                      active ? "border-teal-t" : "border-line"
                    }`}
                  >
                    {building.code}
                  </span>
                  <span className={`text-[14px] font-extrabold tracking-[-0.14px] ${active ? "text-teal-d" : "text-t1"}`}>
                    {building.name}
                  </span>
                </span>
                <span className="pt-[5px] text-[12px] leading-[16.8px] text-t3">{building.address ?? "-"}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
