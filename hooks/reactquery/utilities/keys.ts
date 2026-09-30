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
  scopedPrices: (buildingId: number | null, utilityType: UtilityType) =>
    ["utilities", "scoped-prices", buildingId, utilityType] as const,
  fixedValues: (buildingId: number | null, utilityType: UtilityType) =>
    ["utilities", "fixed-values", buildingId, utilityType] as const,
  supplier: (buildingId: number | null, utilityType: UtilityType) =>
    ["utilities", "supplier", buildingId, utilityType] as const,
  billingPeriod: (buildingId: number | null, period: string) =>
    ["utilities", "billing-period", buildingId, period] as const,
  confirmation: (buildingId: number | null, utilityType: UtilityType, period: string) =>
    ["utilities", "confirmation", buildingId, utilityType, period] as const,
  partnerMeter: (buildingId: number | null, period: string) =>
    ["utilities", "partner-meter", buildingId, period] as const,
};
