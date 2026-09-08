/** Figma 노드 673:21755~ 컬럼 폭(px). 합계 1841 → 모달(1180)보다 넓어 가로 스크롤. */
export const OVERDUE_COL = {
  unit: 724,
  biller: 96,
  period: 88,
  overdue: 52,
  unpaid: 108,
  lateFee: 108,
  postLate: 108,
  lateTotal: 108,
  total: 88,
  note: 152,
  phone: 137,
  name: 72,
} as const;

export const OVERDUE_TABLE_WIDTH = Object.values(OVERDUE_COL).reduce(
  (sum, width) => sum + width,
  0,
);

type Align = "left" | "right";

export interface OverdueHeader {
  key: keyof typeof OVERDUE_COL;
  label: string;
  align: Align;
}

/** 헤더/인쇄뷰 공용 컬럼 메타(좌→우). 숫자열은 우측 정렬. */
export const OVERDUE_HEADERS: OverdueHeader[] = [
  { key: "unit", label: "동호", align: "left" },
  { key: "biller", label: "거래처명", align: "left" },
  { key: "period", label: "년월", align: "left" },
  { key: "overdue", label: "연체", align: "right" },
  { key: "unpaid", label: "미납액", align: "right" },
  { key: "lateFee", label: "납.연체료", align: "right" },
  { key: "postLate", label: "납.후연체", align: "right" },
  { key: "lateTotal", label: "연체료계", align: "right" },
  { key: "total", label: "합계", align: "right" },
  { key: "note", label: "비고", align: "left" },
  { key: "phone", label: "전화", align: "left" },
  { key: "name", label: "이름", align: "left" },
];
