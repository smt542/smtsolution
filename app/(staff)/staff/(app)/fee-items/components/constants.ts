import type { RoundingRule } from "./types";

export const MAX_FEE_ITEMS = 20;

export const ROUNDING_OPTIONS: { value: RoundingRule; label: string }[] = [
  { value: "round", label: "4사5입" },
  { value: "up", label: "절상" },
  { value: "down", label: "절하" },
  { value: "raw", label: "그대로" },
];

export const REQUIRED_ITEM_NAMES = ["전기", "수도료", "가스"] as const;

export const DEFAULT_FORM_VALUE = {
  name: "",
  rounding: "round" as const,
  dailyProration: true,
  carryOver: false,
};
