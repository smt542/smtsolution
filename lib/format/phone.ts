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
