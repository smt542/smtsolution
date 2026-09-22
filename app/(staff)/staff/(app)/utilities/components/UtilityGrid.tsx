import type { ReactNode } from "react";

/**
 * 공과금 3탭(전기·수도·가스)이 공유하는 그리드.
 *
 * 정본(`utility-electric|water|gas.dc.html`)은 세 화면 모두 동일한 `.hf-tbl` 규칙을 쓴다:
 *   th { font-size:12px; font-weight:700; color:var(--t3); padding:11px 16px; background:#FBFCFD;
 *        border-bottom:1px solid var(--line); white-space:nowrap; position:sticky }
 *   td { font-size:13.5px; padding:12px 16px; border-bottom:1px solid var(--line2); white-space:nowrap }
 *   #ucXxxBody td { color:var(--t1); font-weight:500 }   → 행 높이 41px(편집 51px)
 * 세로 괘선은 없다.
 *
 * 표마다 다른 건 컬럼 구성·셀 내용·행 상태뿐이므로 그것만 props로 받는다.
 * 폰트 패밀리는 워크스페이스 루트의 `.utility-reference-font`에서 상속받는다.
 *
 * 세로 여백은 정본의 padding(11/12px) 대신 행 높이(헤더 37px·본문 41px)로 준다.
 * 편집 모드에서 행이 51px로 늘어나는 건 padding으로 표현할 수 없기 때문이다.
 * 실측 결과는 정본과 0.5px 안에서 일치한다(정본 헤더 36.5px·행 40.5~41px).
 */

type ClassFor<T> = string | ((row: T, index: number) => string);

export interface UtilityGridColumn<T> {
  key: string;
  label: ReactNode;
  /** 정본은 좌/우 정렬만 쓴다(`.hf-tbl th{text-align:left}` + `.rt`). 기본 left. */
  align?: "left" | "right";
  /** layout="fixed"일 때 컬럼 폭(px). */
  width?: number;
  /** layout="auto"일 때 컬럼 최소 폭(px) — 정본 th의 `min-width`. */
  minWidth?: number;
  headClassName?: string;
  /** 행 상태에 따라 달라지면 함수로 준다(마커·음수 강조 등). */
  cellClassName?: ClassFor<T>;
  /** 편집 입력이 들어가는 셀. 셀 클릭이 행 클릭으로 번지지 않게 한다. */
  stopRowClick?: boolean;
  render: (row: T, index: number) => ReactNode;
}

export interface UtilityGridProps<T> {
  columns: UtilityGridColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  ariaLabel?: string;
  /** 편집 모드에서 행 높이가 41 → 51로 늘어난다(입력 컨트롤 26px 수용). */
  editing?: boolean;
  /**
   * 정본 기본은 auto — 내용 길이대로 폭이 나뉘고 th `min-width`가 하한이다.
   * 컬럼 폭을 정본 렌더 비율로 못박아야 하는 표는 fixed.
   */
  layout?: "auto" | "fixed";
  /** layout="fixed" 전용. 생략하면 columns[].width 합. */
  tableWidth?: number;
  rowClassName?: ClassFor<T>;
  onRowClick?: (row: T, index: number) => void;
  /** rows가 비었을 때 표 대신 보여줄 내용. */
  empty?: ReactNode;
  /**
   * 스크롤 컨테이너 클래스. 높이를 주는 쪽은 부모마다 다르므로(고정 높이 패널은 `h-full`,
   * flex 패널은 `min-h-0 flex-1`) 호출부가 정한다.
   */
  className?: string;
}

/** 정본 td 기본값. 셀을 직접 조립해야 할 때 쓴다. */
export const UTILITY_GRID_CELL = "px-4 whitespace-nowrap";
/** 값이 없는 셀(정본 `.dsh` = t3 / weight 500). */
export const UTILITY_GRID_DASH = "num px-4 whitespace-nowrap text-right text-t3";

function resolve<T>(value: ClassFor<T> | undefined, row: T, index: number): string {
  if (!value) return "";
  return typeof value === "function" ? value(row, index) : value;
}

export function UtilityGrid<T>({
  columns,
  rows,
  rowKey,
  ariaLabel,
  editing = false,
  layout = "auto",
  tableWidth,
  rowClassName,
  onRowClick,
  empty,
  className,
}: UtilityGridProps<T>) {
  const fixed = layout === "fixed";
  const width = fixed
    ? tableWidth ?? columns.reduce((total, column) => total + (column.width ?? 0), 0)
    : undefined;

  if (rows.length === 0 && empty) {
    return <div className={`overflow-auto ${className ?? ""}`}>{empty}</div>;
  }

  return (
    <div className={`overflow-auto ${className ?? ""}`}>
      <table
        aria-label={ariaLabel}
        className={`border-collapse whitespace-nowrap ${fixed ? "table-fixed" : "w-full"}`}
        style={fixed ? { width } : undefined}
      >
        {fixed && (
          <colgroup>
            {columns.map((column) => <col key={column.key} style={column.width ? { width: column.width } : undefined} />)}
          </colgroup>
        )}
        <thead className="text-[12px] font-bold text-t3">
          <tr className="h-[37px]">
            {columns.map((column) => (
              <th
                key={column.key}
                style={!fixed && column.minWidth ? { minWidth: column.minWidth } : undefined}
                className={`sticky top-0 z-[2] border-b border-line bg-[#FBFCFD] px-4 ${column.align === "right" ? "text-right" : "text-left"} ${column.headClassName ?? ""}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-[13.5px] font-medium text-t1">
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              onClick={onRowClick ? () => onRowClick(row, index) : undefined}
              className={`${editing ? "h-[51px]" : "h-[41px]"} border-b border-line2 ${onRowClick ? "cursor-pointer" : ""} ${resolve(rowClassName, row, index)}`}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  onClick={column.stopRowClick ? (event) => event.stopPropagation() : undefined}
                  className={`${UTILITY_GRID_CELL} ${column.align === "right" ? "text-right" : "text-left"} ${resolve(column.cellClassName, row, index)}`}
                >
                  {column.render(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
