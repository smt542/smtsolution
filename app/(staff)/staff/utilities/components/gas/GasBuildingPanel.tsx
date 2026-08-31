import { ChevronDownIcon, SearchIcon } from "@/components/icons";

export interface GasBuildingOption {
  id: number;
  code?: string | null;
  name: string;
  address?: string | null;
}

interface GasBuildingPanelProps {
  buildings: GasBuildingOption[];
  selectedBuildingId: number | null;
  gasCustomerNumberCounts: Record<number, number>;
  year: number;
  month: number;
  disabled?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onYearChange: (value: number) => void;
  onMonthChange: (value: number) => void;
  onSelect: (buildingId: number) => void;
}

function CompactSelect({
  value,
  label,
  disabled,
  children,
  onChange,
}: {
  value: number;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
  onChange: (value: number) => void;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 appearance-none rounded-[9px] border border-line bg-white pl-3 pr-8 text-[12px] font-bold text-t2 outline-none focus:border-teal disabled:cursor-not-allowed disabled:opacity-45"
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-t3" />
    </label>
  );
}

export function GasBuildingPanel({
  buildings,
  selectedBuildingId,
  gasCustomerNumberCounts,
  year,
  month,
  disabled,
  search,
  onSearchChange,
  onYearChange,
  onMonthChange,
  onSelect,
}: GasBuildingPanelProps) {
  const filteredBuildings = buildings.filter((building) => {
    const query = search.trim().toLowerCase();
    return query === "" || building.name.toLowerCase().includes(query)
      || (building.address ?? "").toLowerCase().includes(query);
  });

  return (
    <aside
      aria-label="건물 선택"
      className={`flex h-full min-h-0 w-[322px] shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-card transition-opacity ${disabled ? "opacity-55" : ""}`}
    >
      <div className="h-[106px] shrink-0 border-b border-line2 px-[18px] pt-[15px]">
        <div className="flex items-center gap-2">
          <h2 className="mr-auto text-[15px] font-extrabold text-t1">전체 건물</h2>
          <CompactSelect value={year} label="조회 연도" disabled={disabled} onChange={onYearChange}>
            {[year - 2, year - 1, year, year + 1].map((option) => (
              <option key={option} value={option}>{option}년</option>
            ))}
          </CompactSelect>
          <CompactSelect value={month} label="조회 월" disabled={disabled} onChange={onMonthChange}>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((option) => (
              <option key={option} value={option}>{option}월분</option>
            ))}
          </CompactSelect>
        </div>
        <label className="relative mt-[9px] block">
          <span className="sr-only">건물명·주소 검색</span>
          <SearchIcon className="pointer-events-none absolute left-[10px] top-1/2 size-[15px] -translate-y-1/2 text-t3" />
          <input
            type="search"
            aria-label="건물명·주소 검색"
            value={search}
            disabled={disabled}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="건물명·주소 검색"
            className="h-[34px] w-full rounded-[9px] border border-line bg-white pl-[31px] pr-3 text-[12px] font-medium text-t1 outline-none placeholder:text-t4 focus:border-teal disabled:cursor-not-allowed disabled:opacity-45"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[70px]" />
            <col className="w-[118px]" />
            <col className="w-[82px]" />
            <col className="w-[52px]" />
          </colgroup>
          <thead className="sticky top-0 z-10 h-[37px] bg-[#fbfcfd] text-[11.5px] font-bold text-t3">
            <tr className="border-b border-line">
              <th className="px-3">코드</th>
              <th>건물명</th>
              <th>주소</th>
              <th className="text-right">가스</th>
            </tr>
          </thead>
          <tbody className="text-[13px] text-t2">
            {filteredBuildings.map((building) => {
              const selected = building.id === selectedBuildingId;
              return (
                <tr
                  key={building.id}
                  className={`h-[41px] border-b border-line2 ${selected ? "bg-teal-t" : "hover:bg-bg"}`}
                >
                  <td className="truncate px-3 text-[12px] text-t3">{building.code ?? "-"}</td>
                  <td>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onSelect(building.id)}
                      className="block w-full truncate text-left font-semibold outline-none disabled:cursor-not-allowed"
                    >
                      {building.name}
                    </button>
                  </td>
                  <td className="truncate text-[12px] text-t3">{building.address ?? "-"}</td>
                  <td className="pr-3 text-right tabular-nums text-t3">
                    {gasCustomerNumberCounts[building.id] ?? 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredBuildings.length === 0 && (
          <p className="py-10 text-center text-[12px] text-t3">검색 결과가 없습니다.</p>
        )}
      </div>
    </aside>
  );
}
