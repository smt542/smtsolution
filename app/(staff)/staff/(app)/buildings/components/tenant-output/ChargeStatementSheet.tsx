import { Fragment } from "react";
import type { StatementSheetPage } from "./statementSheet";

// 정본 stmtForm. 화면 값은 인쇄 규칙(.cf-t2·.cf-stmt)을 화면 비율로 옮긴 값(스펙 §9.2), 인쇄 값은 §9.3.
const CELL =
  "whitespace-nowrap border border-[#999] px-[2px] py-[1px] text-[6px] leading-[1.3] print:border-[0.5pt] print:border-black print:px-[1mm] print:py-[0.5mm] print:text-[6.6pt]";
const HEAD_FILL = "bg-[#F2F3F5] [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:bg-[#EDEDED]";

/** 관리비부과내역서 한 쪽(정본 stmtForm). */
export function ChargeStatementSheet({ page, year, month }: { page: StatementSheetPage; year: number; month: number }) {
  return (
    <div className="font-['Pretendard',sans-serif] text-[8.4px] leading-[1.45] text-black print:text-[9pt] print:leading-[1.5]">
      <div className="mb-[6px] text-center text-[12px] font-extrabold print:mb-[3mm] print:text-[13pt]">
        [ {page.building.name} ]
      </div>
      <table className="w-full table-fixed border-collapse border border-t-0 border-[#444] print:border-[0.8pt] print:border-t-[0.8pt] print:border-black">
        <thead>
          <tr>
            <th className={`${CELL} ${HEAD_FILL} text-center font-bold`}>
              호<br />수
            </th>
            {page.groups.map((names, group) => (
              <th key={group} colSpan={2} className={`${CELL} ${HEAD_FILL} text-left font-semibold`}>
                {names[0] || "\u00a0"}
                <br />
                {names[1] || "\u00a0"}
                <br />
                {names[2] || "\u00a0"}
              </th>
            ))}
            <th className={`${CELL} ${HEAD_FILL} text-center font-semibold`}>
              전기전월
              <br />
              수도전월
            </th>
            <th className={`${CELL} ${HEAD_FILL} text-center font-semibold`}>
              전기금월
              <br />
              수도금월
            </th>
          </tr>
        </thead>
        {page.units.map((unit) => (
          <tbody key={unit.key} className="border-b border-black print:border-b-[1pt]">
            {unit.rows.map((cells, row) => (
              <tr key={row}>
                {row === 0 && (
                  <td rowSpan={3} className={`${CELL} text-center`}>
                    {unit.unitNo}
                  </td>
                )}
                {cells.map((cell, group) => (
                  <Fragment key={group}>
                    {/* 빈 칸도 줄 높이를 지키도록 공백 문자를 둔다(항목이 비면 행이 테두리 높이로 눌린다). */}
                    <td className={`${CELL} text-right tabular-nums`}>{cell.amount || "\u00a0"}</td>
                    <td className={`${CELL} text-center`}>{cell.flag}</td>
                  </Fragment>
                ))}
                {row === 0 && (
                  <>
                    <td rowSpan={3} className={`${CELL} text-right tabular-nums`}>
                      {unit.previous[0]}
                      <br />
                      {unit.previous[1]}
                    </td>
                    <td rowSpan={3} className={`${CELL} text-right tabular-nums`}>
                      {unit.current[0]}
                      <br />
                      {unit.current[1]}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      <div className="mt-[6px] text-right text-[8px] text-[#666] print:mt-[2mm] print:text-[8pt]">
        {page.building.name} · {year}년 {month}월분 · {page.pageIndex + 1} / {page.pageCount} 쪽
      </div>
    </div>
  );
}
