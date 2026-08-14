import type { FeeItemLookupRow } from "@/hooks/reactquery/feeItems";

const ROUNDING_LABELS: Record<string, string> = {
  up: "올림",
  round: "반올림",
  down: "내림",
  raw: "원값",
};

export function FeeItemLookupTable({ rows }: { rows: FeeItemLookupRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-line bg-bg/80 text-left text-t2">
            <th scope="col" className="px-5 py-3.5 font-bold">건물유형</th>
            <th scope="col" className="px-3 py-3.5 font-bold">항목명</th>
            <th scope="col" className="px-3 py-3.5 text-center font-bold">반올림</th>
            <th scope="col" className="px-3 py-3.5 text-center font-bold">일할계산</th>
            <th scope="col" className="px-3 py-3.5 text-center font-bold">이월</th>
            <th scope="col" className="px-3 py-3.5 text-center font-bold">필수</th>
            <th scope="col" className="px-5 py-3.5 text-center font-bold">정렬순서</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line2 last:border-0">
              <td className="px-5 py-4 font-extrabold text-t1">{row.typeLabel}</td>
              <td className="px-3 py-4 text-t1">{row.name}</td>
              <td className="px-3 py-4 text-center text-t2">
                {ROUNDING_LABELS[row.rounding] ?? row.rounding}
              </td>
              <td className="px-3 py-4 text-center font-bold text-t2">
                {row.dailyProration ? "Y" : "N"}
              </td>
              <td className="px-3 py-4 text-center font-bold text-t2">
                {row.carryOver ? "Y" : "N"}
              </td>
              <td className="px-3 py-4 text-center text-t2">
                {row.isRequired ? "필수" : "선택"}
              </td>
              <td className="num px-5 py-4 text-center text-t2">{row.sortOrder}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
