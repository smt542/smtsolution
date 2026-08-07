import React from "react";

export function DataTable({
  columns,
  rows,
  onRowClick,
}: {
  columns: { key: string; label: string }[];
  rows: Record<string, React.ReactNode>[];
  onRowClick?: (row: Record<string, React.ReactNode>) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-bg">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left font-bold text-t2"
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
              className={`border-b border-line last:border-0 ${
                onRowClick ? "cursor-pointer hover:bg-bg" : ""
              }`}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-t1">
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
