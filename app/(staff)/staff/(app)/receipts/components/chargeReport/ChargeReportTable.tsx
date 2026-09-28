import { formatNumber } from "@/lib/format";
import type {
  ReportColumn,
  ReportLine,
  ReportRow,
} from "../report-table/ReportTable3";
import { ReportTable3 } from "../report-table/ReportTable3";
import type { ChargeReportFeeItem, ChargeReportModel } from "./buildChargeReport";

const money = (value: number): ReportLine => ({
  text: formatNumber(value, { nullText: "-" }),
  tone: value < 0 ? "red" : "default",
});

const rateLine = (rate: number | null): ReportLine => ({
  text: rate === null ? "" : `수납>> ${rate.toFixed(1)} %`,
  tone: "red",
});

function feeHeader(column: ChargeReportFeeItem[]): ReportColumn["header"] {
  return [column[0]?.name ?? "", column[1]?.name, column[2]?.name];
}

function feeLines(
  column: ChargeReportFeeItem[],
  amounts: Record<number, number>,
): ReportLine[] {
  return [0, 1, 2].map((index) => {
    const item = column[index];
    return item ? money(amounts[item.feeItemId] ?? 0) : { text: "" };
  });
}

export function ChargeReportTable({ model }: { model: ChargeReportModel }) {
  const { months, feeItemColumns, totals } = model;
  // 정본 `.hf-tbl.ac-tbl`의 컬럼 폭과 3줄 셀 구조를 ReportTable3에 맞춘다.
  const columns: ReportColumn[] = [
    {
      key: "period",
      minWidth: 78,
      align: "left",
      header: ["년 월"],
    },
    {
      key: "charged",
      minWidth: 96,
      align: "right",
      header: ["당 월 분", "수 수 료"],
      redTail: true,
    },
    {
      key: "paid",
      minWidth: 96,
      align: "right",
      header: ["당월수납액", "연 체 료", "실수납액"],
    },
    ...feeItemColumns.map((column, index) => ({
      key: `fee-${index}`,
      minWidth: 96,
      align: "right" as const,
      header: feeHeader(column),
    })),
  ];

  const rows: ReportRow[] = months.map((month) => ({
    key: month.period,
    cells: [
      [{ text: month.periodLabel }],
      [money(month.charged), rateLine(month.rate), money(month.fee)],
      [money(month.paid), money(month.lateFee), money(month.netPaid)],
      ...feeItemColumns.map((column) => feeLines(column, month.feeItemAmounts)),
    ],
  }));

  const total: ReportRow = {
    key: "total",
    cells: [
      [{ text: "총 계" }],
      [money(totals.charged), { text: "" }, money(totals.fee)],
      [money(totals.paid), money(totals.lateFee), money(totals.netPaid)],
      ...feeItemColumns.map((column) => feeLines(column, totals.feeItemAmounts)),
    ],
  };

  return (
    <ReportTable3
      columns={columns}
      rows={rows}
      total={total}
      emptyText="조회된 부과·수납 자료가 없습니다."
    />
  );
}
