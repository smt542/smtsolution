// 건물주·청소 담당자 수신 대상 건물 판정(수신자 선택 cascade 와 발송 이력 요약이 같은 기준을 쓴다).
// 정책(사무실 관리자_문자·알림톡 관리 L51): 범위 = 전체 / 특정 건물.

export function hasRecipientPhone(phone: string | null | undefined): phone is string {
  return !!phone?.replace(/\D/g, "");
}

interface ContactBuilding {
  id: number;
  ownerPhone: string | null;
  cleaningUserId: string | null;
}

interface ContactAccount {
  userId: string;
  phone: string | null;
}

/** 건물별 청소 담당자(전화번호가 있는 계정만). */
export function cleanerByBuildingId<A extends ContactAccount>(
  buildings: readonly ContactBuilding[],
  accounts: readonly A[],
): Map<number, A> {
  return new Map(
    buildings.flatMap((building) => {
      const cleaner = building.cleaningUserId
        ? accounts.find((account) => account.userId === building.cleaningUserId)
        : undefined;
      return cleaner && hasRecipientPhone(cleaner.phone)
        ? ([[building.id, cleaner]] as const)
        : [];
    }),
  );
}

/** 유형별 수신 가능 건물 수: 건물주 = 건물주 전화가 있는 건물, 청소 = 전화 있는 청소 담당이 배정된 건물. */
export function eligibleContactBuildingCounts(
  buildings: readonly ContactBuilding[],
  accounts: readonly ContactAccount[],
): { owner: number; cleaner: number } {
  return {
    owner: buildings.filter((building) => hasRecipientPhone(building.ownerPhone)).length,
    cleaner: cleanerByBuildingId(buildings, accounts).size,
  };
}
