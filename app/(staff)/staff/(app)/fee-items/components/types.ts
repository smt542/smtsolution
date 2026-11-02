export type RoundingRule = "round" | "up" | "down" | "raw";

export interface FeeItemDraft {
  key: string;
  id?: number;
  name: string;
  rounding: RoundingRule;
  dailyProration: boolean;
  carryOver: boolean;
  isRequired: boolean;
  /** 시스템 항목 코드(전월과수납=prev_overpay). 필수 항목처럼 명칭·삭제·순서가 잠긴다. */
  systemCode?: string | null;
  sortOrder: number;
}

export interface BuildingTypeDraft {
  key: string;
  id: number;
  label: string;
  sortOrder: number;
  items: FeeItemDraft[];
}

export interface FeeItemFormValue {
  name: string;
  rounding: RoundingRule;
  dailyProration: boolean;
  carryOver: boolean;
}
