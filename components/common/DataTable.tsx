// components/common/DataTable.tsx
import React from "react";

export function DataTable({
  columns,
  rows,
  onRowClick,
  onRowDoubleClick,
  variant = "default",
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
                  className={`px-[16px] py-[11px] text-left text-[12px] font-bold leading-[normal] text-t3 bg-[#FBFCFD] border-b border-line whitespace-nowrap${
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
                className={`${onRowClick ? "cursor-pointer hover:bg-bg" : ""} last:[&>td]:border-b-0`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-[16px] py-[12px] text-[13.5px] leading-[normal] text-t1 border-b border-line2 whitespace-nowrap${
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
