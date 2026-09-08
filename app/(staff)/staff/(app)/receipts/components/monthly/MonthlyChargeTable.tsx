import type { MonthlyColumn, MonthlyReportModel, MonthlyReportRow } from "./monthlyChargeData";

// 시안 픽셀 충실 재현: 헤더 sticky, 행 높이 73px, 총계 행은 회색 배경 + 상단 보더.
// 열/셀 내용은 실데이터 모델(buildMonthlyReport)에서 주입된다.

function DataRow({
  columns,
  row,
  isTotal = false,
}: {
  columns: MonthlyColumn[];
  row: MonthlyReportRow;
  isTotal?: boolean;
}) {
  const cellBase = isTotal ? "bg-[#f7f9fa] border-t border-line" : "border-b border-line2";
  return (
    <tr className={isTotal ? "sticky bottom-0 z-10" : undefined}>
      {columns.map((col, index) => {
        const lines = row.cells[index] ?? [];
        const alignClass =
          col.align === "left" ? "pl-[16px] pr-[8px] text-left" : "pr-[12px] pl-[8px] text-right";
        return (
          <td
            key={col.key}
            className={`h-[73px] whitespace-nowrap pt-[11px] align-top ${alignClass} ${cellBase}`}
          >
            {lines.map((line, lineIndex) => (
              <span
                key={lineIndex}
                className={`block leading-[17px] ${line.tone === "red" ? "text-red" : "text-t1"}`}
              >
                {line.text}
              </span>
            ))}
          </td>
        );
      })}
    </tr>
  );
}

export function MonthlyChargeTable({ model }: { model: MonthlyReportModel }) {
  const totalWidth = model.columns.reduce((sum, col) => sum + col.width, 0);
  return (
    <table
      className="table-fixed border-collapse text-[12px] font-medium tabular-nums"
      style={{ width: `${totalWidth}px` }}
    >
      <colgroup>
        {model.columns.map((col) => (
          <col key={col.key} style={{ width: `${col.width}px` }} />
        ))}
      </colgroup>
      <thead className="sticky top-0 z-10">
        <tr>
          {model.columns.map((col) => (
            <th
              key={col.key}
              className="h-[73px] whitespace-nowrap border-b border-line bg-[#f7f9fa] px-[8px] text-center align-middle text-[11px] font-medium leading-[17px] text-t1"
            >
              {col.header.map((line, index) => (
                <span key={index} className="block">
                  {line}
                </span>
              ))}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {model.rows.map((row) => (
          <DataRow key={row.key} columns={model.columns} row={row} />
        ))}
        <DataRow columns={model.columns} row={model.total} isTotal />
      </tbody>
    </table>
  );
}
