/**
 * 통화·숫자 표시 포맷(ko-KR).
 *
 * 화면마다 기존 출력이 달라(널 표기 "-"/"", `원` 접미사 유무, 가스 소수 자릿수 등)
 * 이를 그대로 재현하기 위해 옵션으로 받는다. 기본 널 표기는 "-"(하이픈).
 */

export function formatNumber(
  value: number | null | undefined,
  opts: { nullText?: string; fractionDigits?: number } = {},
): string {
  if (value == null) return opts.nullText ?? "-";
  return value.toLocaleString(
    "ko-KR",
    opts.fractionDigits != null
      ? { maximumFractionDigits: opts.fractionDigits }
      : undefined,
  );
}

/** 통화 표시: `1,234원`. 값이 없으면 nullText(기본 "-"). */
export function formatWon(
  value: number | null | undefined,
  opts: { nullText?: string } = {},
): string {
  if (value == null) return opts.nullText ?? "-";
  return `${value.toLocaleString("ko-KR")}원`;
}
