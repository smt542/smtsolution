/** 입주자카드 인쇄 라우트의 세대 행(원문 연락처 포함) — 출력 모달 전용 타입. */
export interface TenantCardSheetRow {
  unitId: number;
  unitNo: string;
  tenantName: string | null;
  roomTypeLabel: string | null;
  residentCount: number | null;
  moveInDate: string | null;
  phone: string | null;
  phone3: string | null;
  areaPyeong: number | null;
  mgmtFeeAmount: number | null;
  increaseAmount: number | null;
  isVacant: boolean;
}

export async function getTenantCardSheetRows(buildingId: number): Promise<TenantCardSheetRow[]> {
  const response = await fetch(`/api/buildings/${buildingId}/tenant-cards/print`, { cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? "입주자 카드 데이터를 불러오지 못했습니다.");
  }
  return ((data ?? []) as TenantCardSheetRow[]).map((row) => ({
    ...row,
    phone3: row.phone3 ?? null,
    areaPyeong: row.areaPyeong ?? null,
    mgmtFeeAmount: row.mgmtFeeAmount ?? null,
    increaseAmount: row.increaseAmount ?? null,
  }));
}
