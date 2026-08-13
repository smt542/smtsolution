import type { UtilityType } from "./apis";

export const utilityKeys = {
  all: ["utilities"] as const,
  rows: (buildingId: number | null, utilityType: UtilityType, period: string) =>
    ["utilities", "rows", buildingId, utilityType, period] as const,
  history: (unitId: number | null, utilityType: UtilityType, period: string) =>
    ["utilities", "history", unitId, utilityType, period] as const,
};
