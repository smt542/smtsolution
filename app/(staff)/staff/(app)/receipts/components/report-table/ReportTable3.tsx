import type { ReactNode } from "react";

export type ReportTone = "default" | "red";

export interface ReportLine {
  text: string;
  tone?: ReportTone;
}

export interface ReportColumn {
  key: string;
  minWidth: number;
  align: "left" | "right";
  headerAlign?: "center" | "right";
  header: [string, string?, string?];
  redTail?: boolean;
}

export interface ReportRow {
  key: string;
  cells: ReportLine[][];
}

export interface ReportTable3Props {
  columns: ReportColumn[];
  rows: ReportRow[];
  total?: ReportRow;
  footer?: ReactNode;
  emptyText?: string;
  lineWeight?: "medium" | "normal";
}

const rowClass = "[&:hover>td]:bg-[#FBFCFD] [&:last-child>td]:border-b-0";

function ReportLines({
  lines,
  lineWeight,
  redTail = false,
  total = false,
}: {
  lines: ReportLine[];
  lineWeight: "medium" | "normal";
  redTail?: boolean;
  total?: boolean;
}) {
  return (
    <>
      {[0, 1, 2].map((lineIndex) => {
        const line = lines[lineIndex];
        const isRed = redTail && lineIndex > 0 ? true : line?.tone === "red";
        const linePositionClass =
          lineIndex === 0
            ? ""
            : lineIndex === 1 && total
              ? "mt-[3px] min-h-[14px]"
              : "mt-[3px]";
        const weightClass = lineWeight === "normal" ? "font-normal" : "font-medium";
        const toneClass = isRed ? "text-red" : "text-t1";
        return (
          <div
            key={lineIndex}
            className={`${linePositionClass} text-[12px] ${weightClass} ${toneClass}`}
          >
            {line?.text ?? ""}
          </div>
        );
      })}
    </>
  );
}

export function ReportTable3({
  columns,
  rows,
  total,
  footer,
  emptyText,
  lineWeight = "medium",
}: ReportTable3Props) {
  const alignClass = (align: ReportColumn["align"]) =>
    align === "right" ? "num text-right" : "text-left";
  const headerAlignClass = (align: ReportColumn["headerAlign"]) =>
    align === "right" ? "text-right" : "text-center";

  // 정본 `.hf-tbl.ac-tbl`의 3줄 보고서 표 공통 렌더.
  return (
    <table className="w-full border-collapse whitespace-nowrap">
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              style={{ minWidth: column.minWidth }}
              className={`sticky top-0 z-[2] border-b border-line bg-[#F7F9FA] px-[16px] py-[11px] align-middle text-[11px] font-medium leading-[1.35] text-t1 ${headerAlignClass(column.headerAlign)}`}
            >
              <div>{column.header[0]}</div>
              <div className="mt-[3px]">{column.header[1] ?? ""}</div>
              <div className="mt-[3px]">{column.header[2] ?? ""}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((row) => (
            <tr key={row.key} className={rowClass}>
              {columns.map((column, columnIndex) => (
                <td
                  key={column.key}
                  className={`border-b border-line2 px-[16px] py-[12px] align-middle text-[13.5px] ${alignClass(column.align)}`}
                >
                  <ReportLines
                    lines={row.cells[columnIndex] ?? []}
                    lineWeight={lineWeight}
                    redTail={column.redTail}
                  />
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr className={rowClass}>
            <td
              colSpan={columns.length}
              className="py-[34px] text-center text-[13.5px] font-medium text-t3"
            >
              {emptyText}
            </td>
          </tr>
        )}
      </tbody>
      {footer !== undefined && footer !== null ? (
        <tfoot>{footer}</tfoot>
      ) : total ? (
        <tfoot>
          <tr>
            {columns.map((column, columnIndex) => (
              <td
                key={column.key}
                className={`sticky bottom-0 border-t-[1.5px] border-line bg-[#F7F9FA] px-[16px] py-[12px] align-middle text-[13.5px] font-medium ${alignClass(column.align)}`}
              >
                <ReportLines
                  lines={total.cells[columnIndex] ?? []}
                  lineWeight={lineWeight}
                  redTail={column.redTail}
                  total
                />
              </td>
            ))}
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}
