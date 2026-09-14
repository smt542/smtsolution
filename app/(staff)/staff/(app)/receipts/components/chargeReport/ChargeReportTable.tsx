import { formatNumber } from "@/lib/format";
import type { ChargeReportFeeItem, ChargeReportModel } from "./buildChargeReport";

// 피그마 컬럼 폭(px) — 피그마 정본 스크린샷 실측값
const COL_MONTH = 148;
const COL_CHARGE = 204;
const COL_PAID = 178;
const COL_FEE = 178;

type Tone = "normal" | "red";
type CellLine = { text: string; tone?: Tone } | null;
type Align = "left" | "center" | "right";

const toneClass: Record<Tone, string> = {
  normal: "text-t1",
  red: "text-red",
};

const money = (value: number): CellLine => ({
  text: formatNumber(value, { nullText: "-" }),
  tone: value < 0 ? "red" : "normal",
});

const rateLine = (rate: number | null): CellLine =>
  rate === null ? null : { text: `수납>> ${rate.toFixed(1)} %`, tone: "red" };

const feeLine = (item: ChargeReportFeeItem | undefined, amounts: Record<number, number>): CellLine =>
  item ? money(amounts[item.feeItemId] ?? 0) : null;

function ReportCell({
  width,
  lines,
  align = "right",
  size = "data",
}: {
  width: number;
  lines: [CellLine, CellLine, CellLine];
  align?: Align;
  size?: "data" | "header";
}) {
  const alignClass =
    align === "left" ? "text-left" : align === "center" ? "text-center" : "text-right";

  if (size === "header") {
    return (
      <div style={{ width }} className="flex h-[73px] shrink-0 flex-col items-center justify-between px-[16px] py-[11px]">
        {lines.map((line, idx) =>
          line ? (
            <span
              key={idx}
              className="block truncate text-center text-[11px] font-medium leading-[14.85px] tabular-nums text-t1"
            >
              {line.text}
            </span>
          ) : (
            <span key={idx} aria-hidden="true" />
          ),
        )}
      </div>
    );
  }

  return (
    <div style={{ width }} className="flex h-[73px] shrink-0 flex-col justify-center px-[16px]">
      {lines.map((line, index) => (
        <span
          key={index}
          title={line?.text}
          className={`block h-[16px] truncate font-medium leading-[16px] tabular-nums text-[12px] ${alignClass} ${
            line ? toneClass[line.tone ?? "normal"] : "text-transparent"
          }`}
        >
          {line ? line.text : " "}
        </span>
      ))}
    </div>
  );
}

function feeHeaderLines(column: ChargeReportFeeItem[]): [CellLine, CellLine, CellLine] {
  return [0, 1, 2].map((index) =>
    column[index] ? { text: column[index].name } : null,
  ) as [CellLine, CellLine, CellLine];
}

function feeDataLines(
  column: ChargeReportFeeItem[],
  amounts: Record<number, number>,
): [CellLine, CellLine, CellLine] {
  return [0, 1, 2].map((index) => feeLine(column[index], amounts)) as [
    CellLine,
    CellLine,
    CellLine,
  ];
}

export function ChargeReportTable({ model }: { model: ChargeReportModel }) {
  const { months, feeItemColumns, totals } = model;

  return (
    <div className="w-max min-w-full">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 flex border-b border-line bg-[#f7f9fa]">
        <ReportCell width={COL_MONTH} align="center" size="header" lines={[null, { text: "년 월" }, null]} />
        <ReportCell
          width={COL_CHARGE}
          align="center"
          size="header"
          lines={[{ text: "당 월 분" }, null, { text: "수 수 료" }]}
        />
        <ReportCell
          width={COL_PAID}
          align="center"
          size="header"
          lines={[{ text: "당월수납액" }, { text: "연 체 료" }, { text: "실수납액" }]}
        />
        {feeItemColumns.map((column, index) => (
          <ReportCell
            key={`fee-head-${index}`}
            width={COL_FEE}
            align="center"
            size="header"
            lines={feeHeaderLines(column)}
          />
        ))}
        <div className="flex-1" />
      </div>

      {/* 월별 데이터 */}
      {months.map((month) => (
        <div key={month.period} className="flex border-b border-line2">
          <ReportCell
            width={COL_MONTH}
            align="center"
            lines={[null, { text: month.periodLabel }, null]}
          />
          <ReportCell
            width={COL_CHARGE}
            lines={[money(month.charged), rateLine(month.rate), money(month.fee)]}
          />
          <ReportCell
            width={COL_PAID}
            lines={[money(month.paid), money(month.lateFee), money(month.netPaid)]}
          />
          {feeItemColumns.map((column, index) => (
            <ReportCell
              key={`fee-${month.period}-${index}`}
              width={COL_FEE}
              lines={feeDataLines(column, month.feeItemAmounts)}
            />
          ))}
          <div className="flex-1" />
        </div>
      ))}

      {/* 총계 */}
      <div className="sticky bottom-0 z-10 flex border-t border-line bg-[#f7f9fa]">
        <ReportCell width={COL_MONTH} align="left" lines={[{ text: "총 계" }, null, null]} />
        <ReportCell
          width={COL_CHARGE}
          lines={[money(totals.charged), rateLine(totals.rate), money(totals.fee)]}
        />
        <ReportCell
          width={COL_PAID}
          lines={[money(totals.paid), money(totals.lateFee), money(totals.netPaid)]}
        />
        {feeItemColumns.map((column, index) => (
          <ReportCell
            key={`fee-total-${index}`}
            width={COL_FEE}
            lines={feeDataLines(column, totals.feeItemAmounts)}
          />
        ))}
        <div className="flex-1" />
      </div>
    </div>
  );
}
