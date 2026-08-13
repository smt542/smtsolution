import type { BillingColumn, BillingUnitRow } from "@/lib/billing/pivot";
import { unitTotal } from "@/lib/billing/total";

export interface BillTargetTableProps {
  units: BillingUnitRow[];
  columns: BillingColumn[];
  period: string;
  labelMode: "code" | "name";
  selected: Set<number>;
  onToggle: (unitId: number) => void;
  onToggleAll: (checked: boolean) => void;
}

export function BillTargetTable({
  units,
  columns,
  period,
  labelMode,
  selected,
  onToggle,
  onToggleAll,
}: BillTargetTableProps) {
  const allChecked = units.length > 0 && units.every((unit) => selected.has(unit.unitId));

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-t3">
          <th className="w-10 p-2">
            <input
              type="checkbox"
              aria-label="전체 선택"
              checked={allChecked}
              onChange={(event) => onToggleAll(event.target.checked)}
            />
          </th>
          <th className="p-2">호실</th>
          <th className="p-2">입주자</th>
          <th className="p-2 text-right">합계</th>
        </tr>
      </thead>
      <tbody>
        {units.map((unit) => {
          const lines = columns.map((column) => {
            const charge = unit.charges[column.feeItemId];
            return {
              charged: charge?.charged ?? false,
              amount: charge?.amount ?? 0,
              dailyProration: column.dailyProration,
              rounding: column.rounding,
            };
          });
          const total = unit.totalAmount ?? unitTotal(lines, unit.moveInDate, period);

          return (
            <tr key={unit.unitId} className="border-b border-line/60">
              <td className="p-2">
                <input
                  type="checkbox"
                  aria-label={`${unit.unitNo} 선택`}
                  checked={selected.has(unit.unitId)}
                  onChange={() => onToggle(unit.unitId)}
                />
              </td>
              <td className="p-2">{unit.unitNo}</td>
              <td className="p-2">
                {labelMode === "code" ? unit.unitNo : (unit.tenantName ?? "-")}
              </td>
              <td className="p-2 text-right tabular-nums">{total.toLocaleString("ko-KR")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
