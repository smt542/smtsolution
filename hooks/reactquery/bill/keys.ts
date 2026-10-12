export const billKeys = {
  all: ["bill"] as const,
  targets: (buildingId: number, period: string) => ["bill", "targets", buildingId, period] as const,
  documents: (buildingId: number, period: string, unitIds: number[]) => ["bill", "documents", buildingId, period, unitIds] as const,
  /** 세대별 그 달 납부 마감일(staff_bill_due_dates — 발행 고지서 → 건물·월 → 기본 납부일 → 말일). */
  dueDates: (period: string, unitIds: number[]) =>
    ["bill", "due-dates", period, [...unitIds].sort((a, b) => a - b)] as const,
  organization: (orgId: number) => ["bill", "organization", orgId] as const,
  /** 서류 발행 모달 데이터(/api/bill/page-data). 셋업 고지서 설정(계좌·안내문·출력옵션)을 담는다. */
  pageDataAll: ["bill", "page-data"] as const,
  pageData: (output: string | null) => ["bill", "page-data", output] as const,
};
