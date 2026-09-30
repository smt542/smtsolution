"use client";
import type { Building } from "@/hooks/reactquery/buildings";

interface BuildingPickerListProps {
  buildings: Building[];
  search: string;
  onSearch: (value: string) => void;
  selectedIds: ReadonlySet<number>;
  onToggle: (id: number) => void;
  /** 정본 `.pm-all` — 검색과 무관하게 목록 전체를 선택/해제한다. */
  onToggleAll: () => void;
}

/** 정본 `.pm-ck` — 17px 체크박스(선택 시 청록 + 흰 체크). */
function PickerCheck({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative h-[17px] w-[17px] flex-none rounded-[5px] border-[1.6px] ${
        on ? "border-teal bg-teal" : "border-line bg-white"
      }`}
    >
      {/* 정본 ::after는 content-box라 선 두께가 4×8 바깥에 붙는다(6×10) — preflight border-box면 체크가 작아진다. */}
      {on && (
        <span className="absolute left-[5px] top-[1.5px] box-content h-[8px] w-[4px] rotate-45 border-solid border-white [border-width:0_2px_2px_0]" />
      )}
    </span>
  );
}

/** 좌측 건물 선택 패널(정본 `.pm-left`) — 코드·건물명·주소 검색 + 다중 선택. */
export function BuildingPickerList({ buildings, search, onSearch, selectedIds, onToggle, onToggleAll }: BuildingPickerListProps) {
  const keyword = search.trim().toLocaleLowerCase("ko-KR");
  const visible = keyword
    ? buildings.filter((building) =>
        `${building.code} ${building.name} ${building.address ?? ""}`
          .toLocaleLowerCase("ko-KR")
          .includes(keyword),
      )
    : buildings;
  const selectedCount = buildings.filter((building) => selectedIds.has(building.id)).length;
  const allSelected = buildings.length > 0 && selectedCount === buildings.length;

  return (
    <div className="flex w-[340px] shrink-0 flex-col border-r border-line bg-[#fbfcfd] leading-[normal]">
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
      <button
        type="button"
        onClick={onToggleAll}
        aria-pressed={allSelected}
        className="group mb-[4px] flex shrink-0 items-center gap-[9px] border-b border-line2 px-[14px] py-[9px] text-left"
      >
        <PickerCheck on={allSelected} />
        <b className={`text-[13.5px] font-bold ${allSelected ? "text-t1" : "text-t2 group-hover:text-t1"}`}>건물 전체</b>
        <i className="ml-auto text-[12px] font-bold not-italic tabular-nums text-t3">
          {selectedCount > 0 ? `${selectedCount}곳 선택` : ""}
        </i>
      </button>
      <div role="group" aria-label="출력할 건물" className="flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto p-[8px]">
        {visible.length === 0 ? (
          <p className="px-[14px] py-[28px] text-center text-[13px] font-semibold text-t3">검색 결과가 없어요</p>
        ) : (
          visible.map((building) => {
            const active = selectedIds.has(building.id);
            return (
              <button
                type="button"
                key={building.id}
                onClick={() => onToggle(building.id)}
                aria-pressed={active}
                className={`block w-full rounded-[12px] border px-[14px] py-[12px] text-left transition duration-100 ${
                  active ? "border-teal bg-teal-t" : "border-transparent hover:border-line hover:bg-white"
                }`}
              >
                <span className="flex items-center gap-[8px]">
                  <PickerCheck on={active} />
                  <span
                    className={`flex-none rounded-[6px] border bg-white px-[7px] py-px text-[11px] font-bold tabular-nums text-t3 ${
                      active ? "border-teal-t" : "border-line"
                    }`}
                  >
                    {building.code}
                  </span>
                  <span className={`text-[14px] font-extrabold tracking-[-0.14px] ${active ? "text-teal-d" : "text-t1"}`}>
                    {building.name}
                  </span>
                </span>
                <span className="ml-[26px] mt-[5px] block text-[12px] font-semibold leading-[1.4] text-t3">
                  {building.address ?? "-"}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
