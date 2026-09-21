export type RoundingRule = "round" | "up" | "down" | "raw";

export interface FeeItemDraft {
  key: string;
  id?: number;
  name: string;
  rounding: RoundingRule;
  dailyProration: boolean;
  carryOver: boolean;
  isRequired: boolean;
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
