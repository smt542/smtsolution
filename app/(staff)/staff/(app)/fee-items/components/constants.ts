import type { RoundingRule } from "./types";

export const MAX_FEE_ITEMS = 20;

// 정본 fee-item RND 순서
export const ROUNDING_OPTIONS: { value: RoundingRule; label: string }[] = [
  { value: "up", label: "절상" },
  { value: "round", label: "4사5입" },
  { value: "down", label: "절하" },
  { value: "raw", label: "그대로" },
];

export const REQUIRED_ITEM_NAMES = ["전기", "수도료", "가스"] as const;

// 정본: 새 항목은 반올림·일자계산·이월을 비워 두고('선택') 셋 다 골라야 추가된다.
export const DEFAULT_FORM_VALUE = {
  name: "",
  rounding: undefined,
  dailyProration: undefined,
  carryOver: undefined,
};
