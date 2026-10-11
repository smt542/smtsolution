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

// 정책: 새 항목 기본값은 일반형(4사5입·적용·안함). 수정 시에는 기존 값을 그대로 쓴다.
export const DEFAULT_FORM_VALUE: {
  name: string;
  rounding: RoundingRule;
  dailyProration: boolean;
  carryOver: boolean;
} = {
  name: "",
  rounding: "round",
  dailyProration: true,
  carryOver: false,
};
