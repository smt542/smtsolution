import type { FeeItemDraft, RoundingRule } from "./types";

export const MAX_FEE_ITEMS = 20;

export const ROUNDING_OPTIONS: { value: RoundingRule; label: string }[] = [
  { value: "round", label: "4사5입" },
  { value: "up", label: "절상" },
  { value: "down", label: "절하" },
  { value: "raw", label: "그대로" },
];

export const REQUIRED_ITEM_NAMES = ["전기", "수도료", "가스"] as const;

export function createRequiredItems(prefix: string): FeeItemDraft[] {
  return REQUIRED_ITEM_NAMES.map((name, index) => ({
    key: `${prefix}-required-${index}`,
    name,
    rounding: "round",
    dailyProration: true,
    carryOver: true,
    isRequired: true,
    sortOrder: index,
  }));
}

/**
 * Every building type must contain the three utility items. Existing rows keep
 * their calculation settings, but their canonical name, required flag, and
 * locked order are repaired when necessary.
 */
export function ensureRequiredItems(prefix: string, items: FeeItemDraft[]): FeeItemDraft[] {
  const remaining = [...items];
  const defaults = createRequiredItems(prefix);
  const required = REQUIRED_ITEM_NAMES.map((name, index) => {
    const existingIndex = remaining.findIndex((item) => item.name.trim() === name);
    if (existingIndex < 0) return defaults[index];

    const [existing] = remaining.splice(existingIndex, 1);
    return {
      ...existing,
      name,
      isRequired: true,
      sortOrder: index,
    };
  });

  return [
    ...required,
    ...remaining.map((item, index) => ({
      ...item,
      sortOrder: required.length + index,
    })),
  ];
}

export const DEFAULT_FORM_VALUE = {
  name: "",
  rounding: "round" as const,
  dailyProration: true,
  carryOver: false,
};
