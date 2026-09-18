/**
 * Canonicalize Korean phone numbers for comparisons and persistence.
 *
 * An empty/non-numeric input is represented as an empty string in TypeScript;
 * the matching SQL helper returns NULL for the same case.
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^0-9]/g, "");
  return digits.startsWith("82") ? `0${digits.slice(2)}` : digits;
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * 표시용 하이픈 포맷. 저장/비교는 normalizePhone.
 *
 * 국번 규칙이 세 갈래다.
 * - `02` 서울: 지역번호 2자리
 * - `15xx`·`16xx`·`17xx`·`18xx` 대표번호: 0으로 시작하지 않는 8자리, 4-4로 끊는다
 * - 나머지: 지역번호/이동통신 3자리
 */
export function formatPhone(value: string): string {
  const number = digits(value).slice(0, 11);
  // 대표번호는 0으로 시작하지 않아 지역번호 규칙과 겹치지 않는다.
  // 8자리를 넘으면 오입력이므로 아래 일반 규칙에 맡긴다.
  if (/^1[5678]/.test(number) && number.length <= 8) {
    if (number.length < 5) return number;
    return `${number.slice(0, 4)}-${number.slice(4)}`;
  }
  if (number.startsWith("02")) {
    if (number.length < 3) return number;
    if (number.length < 6) return `${number.slice(0, 2)}-${number.slice(2)}`;
    if (number.length < 10) {
      return `${number.slice(0, 2)}-${number.slice(2, -4)}-${number.slice(-4)}`;
    }
    return `${number.slice(0, 2)}-${number.slice(2, 6)}-${number.slice(6, 10)}`;
  }
  if (number.length < 4) return number;
  if (number.length < 8) return `${number.slice(0, 3)}-${number.slice(3)}`;
  if (number.length < 11) {
    return `${number.slice(0, 3)}-${number.slice(3, -4)}-${number.slice(-4)}`;
  }
  return `${number.slice(0, 3)}-${number.slice(3, 7)}-${number.slice(7, 11)}`;
}
