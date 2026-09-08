// "월별 부과금액" 리포트의 표시 모델·열 정의·포맷터.
//
// 표 = 고정 메트릭 열(년월/당월분/당월수납액/미납액) + 건물의 실제 관리비 항목으로
// 만든 동적 열(3개씩 스택). 실데이터 집계는 buildMonthlyReport.ts 참고.
// 시각 상수(폭·색·문구)는 Figma 시안(node 673-15261) 실측값을 유지한다.

export type CellTone = "default" | "red";
export type ColumnAlign = "left" | "right";

/** 셀 한 줄: 문구 + 색조(음수·수납율은 red). */
export type CellLine = { text: string; tone?: CellTone };

/** 열: 폭(px, 시안 실측)·정렬·머리글 라인(위→아래, 시안 문구 그대로). */
export type MonthlyColumn = {
  key: string;
  width: number;
  align: ColumnAlign;
  header: string[];
};

/** 한 행: columns 순서에 대응하는 셀 라인 묶음. */
export type MonthlyReportRow = {
  key: string;
  cells: CellLine[][];
};

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

// 고정 메트릭 열(폭=시안 실측). 관리비 항목 열은 런타임에 동적 생성한다.
export const METRIC_COLUMNS: MonthlyColumn[] = [
  { key: "ym", width: 93.766, align: "left", header: ["년 월", "건수"] },
  { key: "current", width: 129.141, align: "right", header: ["당 월 분", "수 수 료"] },
  { key: "paid", width: 115.375, align: "right", header: ["당월수납액", "연 체 료", "실수납액"] },
  { key: "unpaid", width: 115.375, align: "right", header: ["미 납 액", "연 체 료", "납기내금액"] },
];

// 관리비 항목 열 1개 폭(시안 실측, 3개 항목 스택).
export const FEE_COLUMN_WIDTH = 112.328;

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
