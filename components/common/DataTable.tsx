// components/common/DataTable.tsx
import React from "react";

// canon variant 기본값 = 정본 공통 `.hf-tbl`
//   th { font-size:12px; padding:11px 16px }
//   td { font-size:13.5px; padding:12px 16px; color:var(--t1) }
//   tbody tr:hover td { background:#FBFCFD; cursor:pointer }
const CANON_TH = "px-[16px] text-[12px]";
const CANON_TD = "px-[16px] text-[13.5px] text-t1";
const CANON_ROW = "cursor-pointer hover:[&>td]:bg-[#FBFCFD]";

export function DataTable({
  columns,
  rows,
  onRowClick,
  onRowDoubleClick,
  variant = "default",
  thClassName = CANON_TH,
  tdClassName = CANON_TD,
  rowClassName = CANON_ROW,
}: {
  columns: {
    key: string;
    label: string;
    cellClassName?: string;
    headClassName?: string;
  }[];
  rows: Record<string, React.ReactNode>[];
  onRowClick?: (row: Record<string, React.ReactNode>) => void;
  onRowDoubleClick?: (row: Record<string, React.ReactNode>) => void;
  variant?: "default" | "canon";
  /** canon 전용. 정본은 공통 `.hf-tbl` 위에 표별 `#xxTbl` 규칙을 얹으므로 그 층을 그대로 열어 둔다. */
  thClassName?: string;
  tdClassName?: string;
  rowClassName?: string;
}) {
  if (variant === "canon") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`py-[11px] text-left font-bold leading-[normal] text-t3 bg-[#FBFCFD] border-b border-line whitespace-nowrap ${thClassName}${
                    col.headClassName ? ` ${col.headClassName}` : ""
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                onDoubleClick={() => onRowDoubleClick?.(row)}
                className={`${onRowClick ? rowClassName : ""} last:[&>td]:border-b-0`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-[12px] leading-[normal] border-b border-line2 whitespace-nowrap ${tdClassName}${
                      col.cellClassName ? ` ${col.cellClassName}` : ""
                    }`}
                  >
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-bg">
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-3 text-left font-bold text-t2${col.headClassName ? ` ${col.headClassName}` : ""}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              onDoubleClick={() => onRowDoubleClick?.(row)}
              className={`border-b border-line last:border-0 ${
                onRowClick || onRowDoubleClick ? "cursor-pointer hover:bg-bg" : ""
              }`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 text-t1${col.cellClassName ? ` ${col.cellClassName}` : ""}`}>
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
