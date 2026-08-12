import type { UtilityType } from "./apis";

export const utilityKeys = {
  all: ["utilities"] as const,
  rows: (buildingId: number | null, utilityType: UtilityType) =>
    ["utilities", "rows", buildingId, utilityType] as const,
};
