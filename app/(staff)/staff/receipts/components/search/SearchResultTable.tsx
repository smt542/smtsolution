"use client";

/** 통합 조회 모달의 개별 결과 테이블 카드. (Figma 669-12771) */

export interface SearchColumn {
  label: string;
  /** 금액 등 숫자 컬럼은 우측 정렬 */
  align?: "right";
}

export interface SearchResultRow {
  key: string;
  buildingId: number;
  unitId: number | null;
  cells: string[];
}

export function SearchResultTable({
  title,
  columns,
  rows,
  placeholder,
  onJump,
}: {
  title: string;
  columns: SearchColumn[];
  rows: SearchResultRow[];
  placeholder: string;
  onJump: (buildingId: number, unitId: number | null) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line2 bg-[#fbfcfd] px-[13px] py-[9px]">
        <p className="text-[12.5px] font-extrabold text-t2">{title}</p>
        <p className="num text-[12.5px] font-bold text-t3">{rows.length}건</p>
      </div>
      <div className="min-h-[204px] flex-1 overflow-x-auto">
        {rows.length === 0 ? (
          <div className="flex h-[204px] items-center justify-center px-4 text-center">
            <p className="text-[13.5px] font-medium text-t3">{placeholder}</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#fbfcfd]">
                {columns.map((column) => (
                  <th
                    key={column.label}
                    className={`whitespace-nowrap border-b border-line px-[16px] py-[11px] text-[12px] font-bold text-t3 ${
                      column.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  onClick={() => onJump(row.buildingId, row.unitId)}
                  className="cursor-pointer border-b border-line2 last:border-0 hover:bg-blue-t2"
                >
                  {row.cells.map((cell, index) => (
                    <td
                      key={index}
                      className={`whitespace-nowrap px-[16px] py-[10px] text-t1 ${
                        columns[index]?.align === "right" ? "num text-right" : "text-left"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
