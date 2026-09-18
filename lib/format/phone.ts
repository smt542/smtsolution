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

/** 표시용 하이픈 포맷. 저장/비교는 normalizePhone. */
export function formatPhone(value: string): string {
  const number = digits(value).slice(0, 11);
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
