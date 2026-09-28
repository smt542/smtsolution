// "월별 부과금액" 리포트의 표시 모델·열 정의·포맷터.
//
// 표 = 고정 메트릭 열(년월/당월분/당월수납액/미납액) + 건물의 실제 관리비 항목으로
// 만든 동적 열(3개씩 스택). 실데이터 집계는 buildMonthlyReport.ts 참고.
// 시각 규격은 정본 `.hf-tbl.ac-tbl`과 공용 ReportTable3가 책임진다.
import type {
  ReportColumn,
  ReportLine,
  ReportRow,
  ReportTone,
} from "../report-table/ReportTable3";

export type CellTone = ReportTone;
export type ColumnAlign = ReportColumn["align"];

/** 셀 한 줄: 문구 + 색조(음수·수납율은 red). */
export type CellLine = ReportLine;

/** 열·행 모델은 정본 3줄 보고서 표의 공용 타입을 그대로 사용한다. */
export type MonthlyColumn = ReportColumn;
export type MonthlyReportRow = ReportRow;

export type MonthlySummary = {
  periodRange: string; // 기준월 범위 '2026.01 ~ 2026.08'
  paymentDate: string; // 수납일 '전체' 또는 범위
  totalCurrentPaid: number; // 총당월수납액
  totalLateFee: number; // 총연체료
  totalFee: number; // 총수수료
  totalPaid: number; // 총수납액(실수납)
};

export type MonthlyReportModel = {
  columns: MonthlyColumn[];
  rows: MonthlyReportRow[];
  total: MonthlyReportRow;
  summary: MonthlySummary;
};

// 정본 `.acHead`의 고정 메트릭 열. 관리비 항목 열은 런타임에 동적 생성한다.
export const METRIC_COLUMNS: MonthlyColumn[] = [
  { key: "ym", minWidth: 78, align: "left", header: ["년 월", "건수"] },
  {
    key: "current",
    minWidth: 96,
    align: "right",
    header: ["당 월 분", "수 수 료"],
    redTail: true,
  },
  { key: "paid", minWidth: 96, align: "right", header: ["당월수납액", "연 체 료", "실수납액"] },
  { key: "unpaid", minWidth: 96, align: "right", header: ["미 납 액", "연 체 료", "납기내금액"] },
];

/** 숫자 → ko-KR 천단위(음수 부호 유지). */
export function formatNumber(value: number): string {
  return value.toLocaleString("ko-KR");
}

/** 수납율 라인 문구: "수납>> 93.0 %" */
export function formatCollectionRate(rate: number): string {
  return `수납>> ${rate.toFixed(1)} %`;
}

/** 금액 셀 라인: 음수는 빨강. */
export function moneyLine(value: number): CellLine {
  return { text: formatNumber(value), tone: value < 0 ? "red" : "default" };
}
