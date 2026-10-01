import { Input } from "@/components/common";
import { CustomDropdown } from "@/components/common/CustomDropdown";
import { SearchIcon } from "@/components/icons";
import { UC_DROPDOWN_CLASS } from "./ucDropdown";

export interface UtilityBuildingRailBuilding {
  id: number;
  code?: string | null;
  name: string;
  address?: string | null;
}

interface UtilityBuildingRailProps {
  buildings: UtilityBuildingRailBuilding[];
  selectedBuildingId: number | null;
  /** "YYYY-MM-DD" 형식의 기준 날짜 */
  period: string;
  utilityLabel: string;
  customerNumberCounts: Record<number, number>;
  search: string;
  disabled?: boolean;
  onSearchChange: (value: string) => void;
  /** "YYYY-MM-01" 형식으로 호출 */
  onPeriodChange: (period: string) => void;
  onSelectBuilding: (buildingId: number) => void;
}

export function UtilityBuildingRail({
  buildings,
  selectedBuildingId,
  period,
  utilityLabel,
  customerNumberCounts,
  search,
  disabled = false,
  onSearchChange,
  onPeriodChange,
  onSelectBuilding,
}: UtilityBuildingRailProps) {
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

  // 정본 수정 모드 잠금: 연·월 드롭다운 `.uc-dd.locked{opacity:.45}`, 검색창은 disabled만(모양 그대로),
  // 건물 표 `#ucBldWrap.uc-locked{opacity:.55;pointer-events:none}`. 패널 전체를 흐리지 않는다.
  const lockedDropdown = disabled ? "[&_.uc-dd-btn:disabled]:opacity-45" : "";

  return (
    <aside
      aria-label="전체 건물"
      className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-[16px] bg-white shadow-card min-[1101px]:h-full min-[1101px]:w-[322px]"
    >
      <div className="h-[106px] flex-none border-b border-line2 px-[18px] pt-[15px]">
        <div className="flex h-8 items-center gap-1.5">
          <h2 className="min-w-0 flex-1 text-[15px] font-extrabold leading-[normal] tracking-[-0.2px] text-t1">
            전체 건물
          </h2>
          <div className={`flex-none ${UC_DROPDOWN_CLASS} [&_.uc-dd-menu]:min-w-[104px] ${lockedDropdown}`}>
            <CustomDropdown
              chevron="accent"
              menuTransition
              ariaLabel="연도 선택"
              value={year}
              disabled={disabled}
              compact
              options={[2026, 2025, 2024].map((value) => ({ value: String(value), label: `${value}년` }))}
              onChange={(value) => onPeriodChange(`${value}-${month}-01`)}
            />
          </div>
          <div className={`flex-none ${UC_DROPDOWN_CLASS} [&_.uc-dd-menu]:min-w-[112px] ${lockedDropdown}`}>
            <CustomDropdown
              chevron="accent"
              menuTransition
              ariaLabel="월 선택"
              value={month}
              disabled={disabled}
              compact
              options={Array.from({ length: 12 }, (_, index) => {
                const value = String(index + 1).padStart(2, "0");
                return { value, label: `${index + 1}월분` };
              })}
              onChange={(value) => onPeriodChange(`${year}-${value}-01`)}
            />
          </div>
        </div>
        <label className="relative mt-[9px] block">
          <span className="sr-only">건물명·주소 검색</span>
          <SearchIcon className="pointer-events-none absolute left-[11px] top-1/2 size-[15px] -translate-y-1/2 text-t3" />
          <Input
            unstyled
            type="search"
            aria-label="건물명·주소 검색"
            value={search}
            disabled={disabled}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="건물명·주소 검색"
            className="h-[34px] w-full rounded-[9px] border border-line bg-white pl-[31px] pr-[11px] text-[13px] font-semibold text-t1 outline-none placeholder:text-t4 focus:border-teal"
          />
        </label>
      </div>

      <div className={`min-h-0 flex-1 overflow-auto ${disabled ? "pointer-events-none opacity-55" : ""}`}>
        <table className="w-full table-fixed border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[#fbfcfd] text-[12px] font-bold text-t3">
            <tr className="h-[37px] border-b border-line">
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
                  className={`h-[41px] cursor-pointer border-b border-line2 text-[13.5px] transition-colors ${selected ? "bg-blue-t" : "bg-white hover:bg-row-hover"}`}
                  aria-selected={selected}
                >
                  <td className={`truncate px-[11px] font-semibold ${selected ? "text-t1" : "text-t3"}`}>
                    {building.code ?? "-"}
                  </td>
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
          <p className="px-4 py-12 text-center text-[13px] font-medium text-t3">
            조건에 맞는 건물이 없어요.
          </p>
        )}
      </div>
    </aside>
  );
}
