import type { UtilityType } from "./apis";

export const utilityKeys = {
  all: ["utilities"] as const,
  rowsScope: (buildingId: number | null, utilityType: UtilityType) =>
    ["utilities", "rows", buildingId, utilityType] as const,
  rows: (buildingId: number | null, utilityType: UtilityType, period: string) =>
    [...utilityKeys.rowsScope(buildingId, utilityType), period] as const,
  history: (unitId: number | null, utilityType: UtilityType, period: string) =>
    ["utilities", "history", unitId, utilityType, period] as const,
  prices: (buildingId: number | null, utilityType: UtilityType) =>
    ["utilities", "prices", buildingId, utilityType] as const,
  confirmation: (buildingId: number | null, utilityType: UtilityType, period: string) =>
    ["utilities", "confirmation", buildingId, utilityType, period] as const,
};
