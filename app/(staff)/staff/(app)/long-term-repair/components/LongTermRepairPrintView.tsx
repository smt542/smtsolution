import { Fragment } from "react";
import { formatNumber } from "@/lib/format";

export interface LongTermRepairPrintRow {
  key: string;
  entryDate: string;
  entryNo: string;
  fundNote: string;
  deposit: number;
  withdrawal: number;
  balance: number;
}

interface LongTermRepairPrintViewProps {
  buildingName: string;
  startMonth: string;
  endMonth: string;
  rows: LongTermRepairPrintRow[];
}

/**
 * 원본 출력물은 A4 세로·여백 12mm 흰 바탕이다. 용지 설정은 @page로만 지정할 수 있고,
 * 앱 body의 회색 배경은 "배경 그래픽" 인쇄 옵션을 켜면 따라 나오므로 함께 덮는다.
 */
const PRINT_CSS = "@page{size:A4 portrait;margin:12mm}@media print{html,body{background:#fff}}";

// 셀 공통(세로선 #DDE1E5) + 가로선 2종. 같은 셀에 굵은 선과 실선을 함께 주면
// Tailwind 유틸이 서로 덮어써 순서에 의존하므로, 한쪽만 붙여 쓴다.
const CELL = "border-r-[0.4pt] border-r-[#DDE1E5] px-[2mm] py-[1.4mm] last:border-r-0";
const HAIRLINE = "border-b-[0.4pt] border-b-[#C8CCD0]";
const RULE = "border-y-[0.8pt] border-y-[#444]";
const LABEL = "text-right text-[10pt] tracking-[0.1em]";
const CAPTION = "text-right text-[7.4pt]";

const COLUMNS = ["일자", "번호", "적립금내용", "입금액", "출금액", "차인잔액"];

/** 원본은 금액이 없는 칸을 빈칸으로 두므로 0원은 찍지 않는다. */
function amount(value: number) {
  return value ? formatNumber(value) : "";
}

function dotted(date: string) {
  return date.replaceAll("-", ".");
}

/** 【조회일 : 2025 년 12 월 01 일부터 2026 년 08 월 31 일까지】 */
function rangeLabel(startMonth: string, endMonth: string) {
  const [fromYear, fromMonth] = startMonth.split("-");
  const [toYear, toMonth] = endMonth.split("-");
  const lastDay = new Date(Number(toYear), Number(toMonth), 0).getDate();
  return `【조회일 : ${fromYear} 년 ${fromMonth} 월 01 일부터 ${toYear} 년 ${toMonth} 월 ${String(lastDay).padStart(2, "0")} 일까지】`;
}

export function LongTermRepairPrintView({
  buildingName,
  startMonth,
  endMonth,
  rows,
}: LongTermRepairPrintViewProps) {
  const depositTotal = rows.reduce((sum, row) => sum + row.deposit, 0);
  const withdrawalTotal = rows.reduce((sum, row) => sum + row.withdrawal, 0);

  // 원본은 줄높이가 normal 기준이다. 앱 기본 1.5를 그대로 두면 행이 세로로 늘어난다.
  return (
    <article
      className="hidden bg-white text-black leading-[normal] print:block"
      data-testid="long-term-repair-print"
    >
      <style>{PRINT_CSS}</style>

      <h1 className="mb-[7mm] text-center text-[15pt] font-bold tracking-[0.2em]">[ 적 립 금 현 황 ]</h1>
      <div className="mb-[2mm] flex justify-between text-[9pt] font-bold">
        <span>{`【빌라명 : ${buildingName}】`}</span>
        <span>{rangeLabel(startMonth, endMonth)}</span>
      </div>

      <table className="w-full border-collapse border-x-[0.5pt] border-x-[#C8CCD0] text-[8.6pt]">
        <thead>
          <tr className="break-inside-avoid">
            {COLUMNS.map((column) => (
              <th key={column} className={`${CELL} ${RULE} text-center font-bold`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Fragment key={row.key}>
              <tr className="break-inside-avoid">
                <td className={`${CELL} ${HAIRLINE} text-center`}>{dotted(row.entryDate)}</td>
                <td className={`${CELL} ${HAIRLINE} text-center`}>{row.entryNo}</td>
                <td className={`${CELL} ${HAIRLINE}`}>{row.fundNote}</td>
                <td className={`${CELL} ${HAIRLINE} text-right`}>{amount(row.deposit)}</td>
                <td className={`${CELL} ${HAIRLINE} text-right`}>{amount(row.withdrawal)}</td>
                <td className={`${CELL} ${HAIRLINE} text-right`}>{formatNumber(row.balance)}</td>
              </tr>
              <tr className="break-inside-avoid">
                <td className={`${CELL} ${HAIRLINE}`} />
                <td className={`${CELL} ${HAIRLINE}`} />
                <td className={`${CELL} ${HAIRLINE} ${LABEL}`}>{dotted(row.entryDate).slice(0, 7)}</td>
                <td className={`${CELL} ${HAIRLINE} text-right`}>
                  {amount(row.deposit)}
                  <div className={CAPTION}>월잔액</div>
                </td>
                <td className={`${CELL} ${HAIRLINE} text-right`}>{amount(row.deposit)}</td>
                <td className={`${CELL} ${HAIRLINE}`} />
              </tr>
            </Fragment>
          ))}
          <tr className="break-inside-avoid">
            <td className={`${CELL} ${RULE}`} />
            <td className={`${CELL} ${RULE}`} />
            <td className={`${CELL} ${RULE} ${LABEL} font-bold`}>{"합　계　>>"}</td>
            <td className={`${CELL} ${RULE} text-right font-bold`}>
              {formatNumber(depositTotal)}
              <div className={CAPTION}>현잔액</div>
            </td>
            <td className={`${CELL} ${RULE} text-right font-bold`}>
              {formatNumber(depositTotal - withdrawalTotal)}
            </td>
            <td className={`${CELL} ${RULE}`} />
          </tr>
        </tbody>
      </table>
    </article>
  );
}
