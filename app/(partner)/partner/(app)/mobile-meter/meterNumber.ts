/**
 * 검침 입력칸 숫자 처리. 정본은 입력할 때마다 천 단위 콤마를 붙이고 커서를 제자리에 둔다(`fmt`).
 * 지침은 numeric(12,2)라 정본과 달리 소수 둘째 자리까지 받는다.
 */

/** 입력 문자열 → 콤마 없는 숫자 문자열. 숫자와 첫 '.'만 남긴다. */
export function cleanReading(raw: string): string {
  let whole = "";
  let fraction = "";
  let hasDot = false;
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      if (!hasDot) whole += ch;
      else if (fraction.length < 2) fraction += ch;
    } else if (ch === "." && !hasDot) {
      hasDot = true;
    }
  }
  whole = whole.replace(/^0+(?=\d)/, "");
  if (hasDot) return `${whole || "0"}.${fraction}`;
  return whole;
}

/** 숫자 문자열 → 콤마 표시. 입력 중인 끝 '.'은 그대로 둔다. */
export function formatReading(value: string): string {
  if (value === "") return "";
  const [whole, fraction] = value.split(".");
  const grouped = (whole || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

/** 숫자 문자열 → 숫자. 빈 값은 null. */
export function readingNumber(value: string): number | null {
  if (value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** 숫자 → 입력칸 값(콤마 없음, 소수 둘째 자리 반올림). */
export function readingText(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * 입력칸 값을 콤마 형식으로 바꿔 쓰고 커서를 보존한다. 콤마 없는 값을 돌려준다.
 * 커서 앞 숫자·'.' 개수를 기준으로 되돌린다(components/common/maskedField `applyMask`와 같은 방식).
 */
export function applyReadingInput(element: HTMLInputElement): string {
  const raw = element.value;
  const caret = element.selectionStart ?? raw.length;
  const before = raw.slice(0, caret).replace(/[^0-9.]/g, "").length;
  const clean = cleanReading(raw);
  const next = formatReading(clean);

  element.value = next;
  let position = before > 0 ? next.length : 0;
  let seen = 0;
  for (let i = 0; i < next.length && before > 0; i += 1) {
    if ((next[i] >= "0" && next[i] <= "9") || next[i] === ".") {
      seen += 1;
      if (seen === before) {
        position = i + 1;
        break;
      }
    }
  }
  element.setSelectionRange(position, position);
  return clean;
}
