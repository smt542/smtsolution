import { Select } from "@/components/common";
import {
  useUtilityPrices,
  type UtilityUnitRow,
} from "@/hooks/reactquery/utilities";
import {
  formatNumber as formatSharedNumber,
  formatWon,
} from "@/lib/format";

export const UNASSIGNED_GAS_LINE = "__unassigned__";

interface GasSummaryTableProps {
  buildingId: number;
  rows: UtilityUnitRow[];
  selectedLine: string;
  onLineChange: (line: string) => void;
}

interface SummaryRow {
  key: string;
  customerNumber: string | null;
  holderName: string | null;
  unitCount: number;
  usage: number;
  charge: number;
  sortOrder: number;
}

function formatNumber(value: number): string {
  return formatSharedNumber(value, { fractionDigits: 3 });
}

export function GasSummaryTable({
  buildingId,
  rows,
  selectedLine,
  onLineChange,
}: GasSummaryTableProps) {
  const pricesQuery = useUtilityPrices(buildingId, "gas");
  const prices = pricesQuery.data ?? [];
  const priceByCustomerNumber = new Map(
    prices.map((price) => [price.customerNo, price]),
  );
  const grouped = new Map<string, SummaryRow>();

  rows.forEach((row) => {
    const key = row.customerNumber ?? UNASSIGNED_GAS_LINE;
    const current = grouped.get(key);
    const price = row.customerNumber
      ? priceByCustomerNumber.get(row.customerNumber)
      : undefined;
    if (current) {
      current.unitCount += 1;
      current.usage += row.usage ?? 0;
      current.charge += row.manualCharge ?? row.automaticCharge ?? 0;
      return;
    }
    grouped.set(key, {
      key,
      customerNumber: row.customerNumber,
      holderName: price?.holderName ?? null,
      unitCount: 1,
      usage: row.usage ?? 0,
      charge: row.manualCharge ?? row.automaticCharge ?? 0,
      sortOrder: price?.sortOrder ?? Number.MAX_SAFE_INTEGER,
    });
  });

  const summaryRows = [...grouped.values()].sort((a, b) => {
    if (a.customerNumber === null) return 1;
    if (b.customerNumber === null) return -1;
    return a.sortOrder - b.sortOrder
      || a.customerNumber.localeCompare(b.customerNumber, "ko-KR");
  });
  const lineOptions = [
    { value: "", label: "전체" },
    ...summaryRows.map((row) => ({
      value: row.key,
      label: row.customerNumber === null
        ? "미지정"
        : `${row.customerNumber}${row.holderName ? ` · ${row.holderName}` : ""}`,
    })),
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line2 px-5 py-4">
        <div>
          <h2 className="text-base font-extrabold text-t1">가스 고객번호별 요약</h2>
          <p className="mt-1 text-xs text-t3">고객번호를 라인으로 묶어 사용량과 요금을 확인합니다.</p>
        </div>
        <label className="w-full sm:w-64">
          <span className="mb-1.5 block text-xs font-bold text-t2">라인</span>
          <Select
            aria-label="라인 필터"
            value={selectedLine}
            onChange={(event) => onLineChange(event.target.value)}
            options={lineOptions}
          />
        </label>
      </div>

      {pricesQuery.error && (
        <p className="border-b border-line2 bg-amber-t px-5 py-3 text-xs font-semibold text-t2">
          예금주 정보를 불러오지 못해 고객번호만 표시합니다.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-[#FBFCFD] text-left text-xs font-bold text-t3">
              <th className="px-5 py-3">고객번호</th>
              <th className="px-5 py-3 text-right">세대수</th>
              <th className="px-5 py-3 text-right">사용량 합계</th>
              <th className="px-5 py-3 text-right">요금 합계</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.map((row) => (
              <tr key={row.key} className="border-b border-line2 last:border-b-0">
                <td className="px-5 py-3">
                  <strong className="block text-t1">{row.customerNumber ?? "미지정"}</strong>
                  {row.holderName && (
                    <span className="mt-0.5 block text-xs text-t3">예금주 {row.holderName}</span>
                  )}
                </td>
                <td className="num px-5 py-3 text-right font-semibold text-t2">
                  {formatSharedNumber(row.unitCount)}세대
                </td>
                <td className="num px-5 py-3 text-right font-semibold text-t1">
                  {formatNumber(row.usage)}
                </td>
                <td className="num px-5 py-3 text-right font-bold text-blue-d">
                  {formatWon(row.charge)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
