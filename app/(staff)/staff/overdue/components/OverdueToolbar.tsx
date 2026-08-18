import { Select } from "@/components/common";
import type { OverdueBuilding, OverdueScope } from "@/hooks/reactquery/overdue";

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
  disabled = false,
}: {
  buildings: OverdueBuilding[];
  selectedBuildingId: number | null;
  onBuildingChange: (buildingId: number | null) => void;
  targetYear: number;
  targetMonth: number;
  scope: OverdueScope;
  onPeriodChange: (year: number, month: number) => void;
  onScopeChange: (scope: OverdueScope) => void;
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
  const targetPeriod = `${String(targetYear).padStart(4, "0")}-${String(targetMonth).padStart(2, "0")}`;
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <section
      aria-label="미납 조회 조건"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <label className="w-full space-y-1.5 text-xs font-bold text-t2 xl:max-w-xs">
          건물 선택
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
        </label>

        <label className="w-full space-y-1.5 text-xs font-bold text-t2 sm:w-44">
          조회 기간
          <input
            type="month"
            aria-label="조회 기간"
            value={targetPeriod}
            max={currentPeriod}
            onChange={(event) => {
              const [year, month] = event.target.value.split("-").map(Number);
              if (Number.isInteger(year) && Number.isInteger(month)) {
                onPeriodChange(year, month);
              }
            }}
            className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-t1 focus:border-brand focus:outline-none"
          />
        </label>

        <label className="w-full space-y-1.5 text-xs font-bold text-t2 sm:w-36">
          범위
          <Select
            aria-label="범위"
            value={scope}
            options={[
              { value: "all", label: "전체" },
              { value: "current", label: "당계" },
            ]}
            onChange={(event) => onScopeChange(event.target.value as OverdueScope)}
          />
        </label>

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

        <div className="flex min-h-11 items-center gap-2 text-xs font-semibold text-t3 sm:text-sm">
          <span className="rounded-full bg-bg px-2.5 py-1 text-t2">고정 조건</span>
          <span>연체 2개월 이상 AND 미납 10만원 이상</span>
        </div>
      </div>
    </section>
  );
}

