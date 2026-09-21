export type MaskKind = "phone" | "fax";

function maskPhoneLikeValue(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return "";

  const input = raw.trim();
  if (!input) return "";

  const digits = input.replace(/\D/g, "");
  if (!digits) return "*".repeat(input.length);

  const leadingGroupLength = digits.startsWith("02") ? 2 : 3;
  const middleLength = digits.length - leadingGroupLength - 4;
  if (middleLength <= 0) return "*".repeat(digits.length);

  return `${digits.slice(0, leadingGroupLength)}-${"*".repeat(middleLength)}-${digits.slice(-4)}`;
}

/**
 * Presentation-only masking. Add future kinds to MaskKind and this dispatch
 * without changing the call signature used by consumers.
 */
export function maskValue(kind: MaskKind, raw: string | null | undefined): string {
  switch (kind) {
    case "phone":
    case "fax":
      return maskPhoneLikeValue(raw);
  }
}
