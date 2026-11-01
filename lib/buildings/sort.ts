/**
 * 건물 목록 정렬 단일 기준(2026-11-01 QA #15): 건물 코드 오름차순 → id 오름차순.
 * 서버 SQL 은 `order by b.code, b.id`, 클라이언트 재정렬은 이 비교 함수를 쓴다.
 * 코드는 숫자 3자리 zero-padding 이 기본이지만 레거시 코드가 섞여도 안전하도록 numeric 비교를 쓴다.
 */
export function compareBuildingCode(
  a: { code: string | null | undefined; id: number },
  b: { code: string | null | undefined; id: number },
): number {
  return (a.code ?? "").localeCompare(b.code ?? "", "en", { numeric: true }) || a.id - b.id;
}
