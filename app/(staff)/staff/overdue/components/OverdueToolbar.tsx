import { Select } from "@/components/common";
import type { OverdueBuilding } from "@/hooks/reactquery/overdue";

export function OverdueToolbar({
  buildings,
  selectedBuildingId,
  onBuildingChange,
  debtFilterEnabled,
  onToggleDebtFilter,
  disabled = false,
}: {
  buildings: OverdueBuilding[];
  selectedBuildingId: number | null;
  onBuildingChange: (buildingId: number | null) => void;
  debtFilterEnabled: boolean;
  onToggleDebtFilter: () => void;
  disabled?: boolean;
}) {
  const options = [
    { value: "", label: "건물을 선택해 주세요" },
    ...buildings.map((building) => ({
      value: String(building.id),
      label: building.name,
    })),
  ];

  return (
    <section
      aria-label="미납 조회 조건"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="w-full lg:max-w-xs">
          <label htmlFor="overdue-building" className="sr-only">
            건물 선택
          </label>
          <Select
            id="overdue-building"
            aria-label="건물 선택"
            options={options}
            value={selectedBuildingId ?? ""}
            disabled={disabled}
            onChange={(event) =>
              onBuildingChange(event.target.value ? Number(event.target.value) : null)
            }
          />
        </div>

        <button
          type="button"
          aria-pressed={debtFilterEnabled}
          disabled={selectedBuildingId === null}
          onClick={onToggleDebtFilter}
          className={`h-11 rounded-xl px-4 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            debtFilterEnabled
              ? "bg-red text-white shadow-sm"
              : "bg-red-t text-red hover:bg-red/15"
          }`}
        >
          채권 관리 필터
        </button>

        <div className="flex items-center gap-2 text-xs font-semibold text-t3 sm:text-sm">
          <span className="rounded-full bg-bg px-2.5 py-1 text-t2">고정 조건</span>
          <span>연체 3개월 이상 AND 미납 10만원 이상</span>
        </div>
      </div>
    </section>
  );
}

