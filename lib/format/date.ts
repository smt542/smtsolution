/**
 * 날짜·기간 표시 포맷.
 *
 * 화면마다 기존 출력이 달라(dot `2024.01.15` vs Intl `2024. 01. 15.`, 널 표기 "—"/"-"/"")
 * 스타일별 함수 + nullText 옵션으로 그대로 재현한다. 기본 널 표기는 "—".
 */

/** ISO 날짜 → `2024.01.15` (dot, 앞 10자). */
export function formatDate(
  value: string | null | undefined,
  opts: { nullText?: string } = {},
): string {
  if (!value) return opts.nullText ?? "—";
  return value.slice(0, 10).replaceAll("-", ".");
}

/** ISO 월 → `2024.01` (dot, 앞 7자). */
export function formatMonth(
  value: string | null | undefined,
  opts: { nullText?: string } = {},
): string {
  if (!value) return opts.nullText ?? "—";
  return value.slice(0, 7).replaceAll("-", ".");
}

/** ISO 날짜 → `2024. 01. 15.` (Intl ko-KR, 2-digit). 파싱 불가 시 원문 반환. */
export function formatDateIntl(
  value: string | null | undefined,
  opts: { nullText?: string } = {},
): string {
  if (!value) return opts.nullText ?? "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** ISO datetime → `2024. 01. 15. 09:30` (Intl ko-KR). 값 없음/파싱 불가 시 nullText. */
export function formatDateTime(
  value: string | null | undefined,
  opts: { nullText?: string } = {},
): string {
  if (!value) return opts.nullText ?? "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return opts.nullText ?? "—";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
