/** 삭제 확인창에 덧붙이는 '과거 데이터 영향' 경고(정책: 부과·수납 이력 보유 시 경고 후 진행, 차단 없음). */
export function deleteImpactWarning(
  impact: { confirmationCount: number; paymentCount: number } | null,
  target: "건물" | "호수",
): string {
  if (impact === null) {
    // 이력 조회에 실패해도 삭제는 막지 않는다. 이력이 있을 수 있음을 알린다.
    return `부과·수납 이력이 있으면 과거 데이터에 영향을 줄 수 있어요. (이력 확인 실패)\n`;
  }
  if (impact.confirmationCount === 0 && impact.paymentCount === 0) return "";
  return `이 ${target}에는 부과 ${impact.confirmationCount}건·수납 ${impact.paymentCount}건의 이력이 있어요. 삭제하면 과거 부과·수납 데이터에 영향을 줍니다.\n`;
}
