import type { KeyboardEvent, MouseEvent } from "react";
import type { OverdueHousehold } from "@/hooks/reactquery/overdue";
import { formatDate, formatWon } from "../utils";

export function OverdueTable({
  rows,
  selectedIds,
  onToggleOne,
  onToggleAll,
  onRowClick,
}: {
  rows: OverdueHousehold[];
  selectedIds: Set<number>;
  onToggleOne: (occupancyId: number) => void;
  onToggleAll: () => void;
  onRowClick: (row: OverdueHousehold) => void;
}) {
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.occupancyId));

  const stopRowClick = (event: MouseEvent<HTMLInputElement>) => event.stopPropagation();
  const openWithKeyboard = (event: KeyboardEvent<HTMLTableRowElement>, row: OverdueHousehold) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[840px] text-sm">
        <thead>
          <tr className="border-b border-line bg-bg/80 text-left text-t2">
            <th scope="col" className="w-14 px-5 py-3.5">
              <input
                type="checkbox"
                aria-label="전체 세대 선택"
                checked={allSelected}
                onChange={onToggleAll}
                className="h-4 w-4 rounded border-line accent-brand"
              />
            </th>
            <th scope="col" className="px-3 py-3.5 font-bold">호실명</th>
            <th scope="col" className="px-3 py-3.5 font-bold">입주자명</th>
            <th scope="col" className="px-3 py-3.5 font-bold">연락처</th>
            <th scope="col" className="px-3 py-3.5 text-right font-bold">연체 개월수</th>
            <th scope="col" className="px-3 py-3.5 text-right font-bold">미납금액</th>
            <th scope="col" className="px-5 py-3.5 font-bold">최근 납부일</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const unitLabel = [row.dong, row.unitNo].filter(Boolean).join(" ");
            return (
              <tr
                key={row.occupancyId}
                tabIndex={0}
                aria-label={`${unitLabel} ${row.tenantName ?? "입주자 미등록"} 상세 보기`}
                onClick={() => onRowClick(row)}
                onKeyDown={(event) => openWithKeyboard(event, row)}
                className="cursor-pointer border-b border-line2 transition last:border-0 hover:bg-blue-t2 focus:bg-blue-t2 focus:outline-none"
              >
                <td className="px-5 py-4">
                  <input
                    type="checkbox"
                    aria-label={`${unitLabel} 선택`}
                    checked={selectedIds.has(row.occupancyId)}
                    onClick={stopRowClick}
                    onChange={() => onToggleOne(row.occupancyId)}
                    className="h-4 w-4 rounded border-line accent-brand"
                  />
                </td>
                <td className="px-3 py-4 font-extrabold text-t1">{unitLabel}</td>
                <td className="px-3 py-4 text-t1">{row.tenantName || "미등록"}</td>
                <td className="num px-3 py-4 text-t3">{row.phone || "—"}</td>
                <td className="px-3 py-4 text-right">
                  <span className={row.billingAvailable ? "font-bold text-red" : "text-t3"}>
                    {row.overdueMonths}개월
                  </span>
                </td>
                <td className={`num px-3 py-4 text-right font-bold ${row.billingAvailable ? "text-red" : "text-t3"}`}>
                  {formatWon(row.overdueAmount)}
                </td>
                <td className="num px-5 py-4 text-t3">{formatDate(row.lastPaymentDate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

