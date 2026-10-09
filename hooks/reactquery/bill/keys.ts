export const billKeys = {
  all: ["bill"] as const,
  targets: (buildingId: number, period: string) => ["bill", "targets", buildingId, period] as const,
  documents: (buildingId: number, period: string, unitIds: number[]) => ["bill", "documents", buildingId, period, unitIds] as const,
  organization: (orgId: number) => ["bill", "organization", orgId] as const,
  /** 서류 발행 모달 데이터(/api/bill/page-data). 셋업 고지서 설정(계좌·안내문·출력옵션)을 담는다. */
  pageDataAll: ["bill", "page-data"] as const,
  pageData: (output: string | null) => ["bill", "page-data", output] as const,
};
