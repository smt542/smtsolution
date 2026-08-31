import { ChevronDownIcon, SearchIcon } from "@/components/icons";
import type { Building } from "@/hooks/reactquery/buildings";

interface ElectricityBuildingRailProps {
  buildings: Building[];
  selectedBuildingId: number | null;
  search: string;
  period: string;
  utilityLabel: string;
  customerNumberCounts: Record<number, number>;
  disabled?: boolean;
  onSearchChange: (value: string) => void;
  onPeriodChange: (period: string) => void;
  onSelectBuilding: (buildingId: number) => void;
}

function SelectShell({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="relative block w-full min-w-0">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full appearance-none rounded-[8px] border border-line bg-white px-2.5 pr-7 text-[12px] font-bold text-t1 outline-none focus:border-teal disabled:bg-line2 disabled:text-t4"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2 top-2 size-4 text-t3" />
    </label>
  );
}

export function ElectricityBuildingRail({
  buildings,
  selectedBuildingId,
  search,
  period,
  utilityLabel,
  customerNumberCounts,
  disabled = false,
  onSearchChange,
  onPeriodChange,
  onSelectBuilding,
}: ElectricityBuildingRailProps) {
  const year = period.slice(0, 4);
  const month = period.slice(5, 7);
  const filteredBuildings = buildings.filter((building) => {
    const keyword = search.trim().toLocaleLowerCase("ko-KR");
    if (!keyword) return true;
    return [building.code, building.name, building.address ?? ""]
      .join(" ")
      .toLocaleLowerCase("ko-KR")
      .includes(keyword);
  });

  return (
    <aside
      aria-label="전체 건물"
      className={`flex h-full min-h-[640px] min-w-0 flex-col overflow-hidden rounded-card bg-white shadow-card transition-opacity lg:w-[322px] lg:flex-none ${disabled ? "pointer-events-none opacity-45" : ""}`}
    >
      <div className="h-[106px] flex-none border-b border-line2 px-[18px] pt-[15px]">
        <div className="flex h-8 items-center gap-1.5">
          <h2 className="min-w-0 flex-1 text-[15px] font-extrabold leading-[19px] tracking-[-0.2px] text-t1">전체 건물</h2>
          <div className="w-[87px] flex-none">
            <SelectShell
              label="연도 선택"
              value={year}
              disabled={disabled}
              options={[2024, 2025, 2026, 2027, 2028].map((value) => ({ value: String(value), label: `${value}년` }))}
              onChange={(value) => onPeriodChange(`${value}-${month}-01`)}
            />
          </div>
          <div className="w-[77px] flex-none">
            <SelectShell
              label="월 선택"
              value={month}
              disabled={disabled}
              options={Array.from({ length: 12 }, (_, index) => {
                const value = String(index + 1).padStart(2, "0");
                return { value, label: `${index + 1}월분` };
              })}
              onChange={(value) => onPeriodChange(`${year}-${value}-01`)}
            />
          </div>
        </div>
        <label className="relative mt-3 block">
          <span className="sr-only">건물명·주소 검색</span>
          <SearchIcon className="pointer-events-none absolute left-2.5 top-2 size-4 text-t3" />
          <input
            type="search"
            aria-label="건물명·주소 검색"
            value={search}
            disabled={disabled}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="건물명·주소 검색"
            className="h-8 w-full rounded-[8px] border border-line bg-white pl-8 pr-3 text-[12px] font-medium text-t1 outline-none placeholder:text-t4 focus:border-teal disabled:bg-line2"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[#fbfcfd] text-[10px] font-bold text-t3">
            <tr className="h-[36px] border-b border-line2">
              <th className="w-[70px] px-[11px]">코드</th>
              <th className="w-[118px] px-[11px]">건물명</th>
              <th className="w-[82px] px-[11px]">주소</th>
              <th className="w-[52px] px-[11px] text-right">{utilityLabel}</th>
            </tr>
          </thead>
          <tbody>
            {filteredBuildings.map((building) => {
              const selected = selectedBuildingId === building.id;
              return (
                <tr
                  key={building.id}
                  onClick={() => onSelectBuilding(building.id)}
                  className={`h-[41px] cursor-pointer border-b border-line2 text-[13.5px] transition-colors ${selected ? "bg-[#e2f5f1]" : "bg-white hover:bg-bg"}`}
                  aria-selected={selected}
                >
                  <td className={`truncate px-[11px] font-semibold ${selected ? "text-t1" : "text-t3"}`}>{building.code}</td>
                  <td className="truncate px-[11px] font-bold text-t1">{building.name}</td>
                  <td className="truncate px-[11px] font-medium text-t1">{building.address ?? "-"}</td>
                  <td className="num px-[11px] text-right font-bold text-t1">
                    {customerNumberCounts[building.id] ?? 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredBuildings.length === 0 && (
          <p className="px-4 py-12 text-center text-xs font-semibold text-t3">검색 결과가 없습니다.</p>
        )}
      </div>
    </aside>
  );
}
