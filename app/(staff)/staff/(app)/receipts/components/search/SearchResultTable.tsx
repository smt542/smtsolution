"use client";

import type { ReactNode } from "react";

/** 통합 조회 모달의 개별 결과 테이블 카드. (Figma 669-12771) */

export interface SearchColumn {
  label: string;
  /** 금액 등 숫자 컬럼은 우측 정렬 */
  align?: "right";
  width?: number;
  minWidth?: number;
  strong?: boolean;
}

export interface SearchResultRow {
  key: string;
  buildingId: number;
  unitId: number | null;
  cells: ReactNode[];
}

export function SearchResultTable({
  title,
  columns,
  rows,
  placeholder,
  onJump,
  clickable = true,
}: {
  title: string;
  columns: SearchColumn[];
  rows: SearchResultRow[];
  placeholder: string;
  onJump: (buildingId: number, unitId: number | null) => void;
  clickable?: boolean;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[12px] border border-line bg-surface">
      <div className="flex shrink-0 items-center justify-between gap-[8px] border-b border-line2 bg-[#FBFCFD] px-[13px] py-[9px] text-[12.5px] font-extrabold text-t2">
        <span>{title}</span>
        <span className="num text-[12.5px] font-bold text-t3">{rows.length}건</span>
      </div>
      <div className="min-h-[110px] flex-1 overflow-auto">
        <table className="w-full border-collapse whitespace-nowrap">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.label}
                  style={{ width: column.width, minWidth: column.minWidth }}
                  className={`sticky top-0 z-[2] whitespace-nowrap border-b border-line bg-[#FBFCFD] px-[16px] py-[11px] text-[12px] font-bold text-t3 ${
                    column.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr
                  key={row.key}
                  onClick={clickable ? () => onJump(row.buildingId, row.unitId) : undefined}
                  className={clickable ? "cursor-pointer [&:hover>td]:bg-row-hover-accent" : undefined}
                >
                  {/* 정본 조회 표의 `-`는 `<span class="dsh">`지만 `.dsh` 규칙이 호실 표(`#rcUnitBody td.dsh`)에만
                    있어 셀 글자와 같은 색·굵기로 렌더된다. 그래서 `-`도 따로 꾸미지 않는다. */}
                  {row.cells.map((cell, index) => {
                    const column = columns[index];
                    return (
                      <td
                        key={index}
                        className={`${
                          column?.align === "right" ? "num text-right" : "text-left"
                        } whitespace-nowrap border-b border-line2 px-[16px] py-[12px] text-[13.5px] text-t1 ${
                          column?.strong ? "font-semibold" : ""
                        }`}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-[34px] text-center text-[13.5px] font-medium text-t3"
                >
                  {placeholder}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
