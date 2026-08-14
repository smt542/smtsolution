export const paymentKeys = {
  all: ["payments"] as const,
  rows: (buildingId: number, period: string) => ["payments", "rows", buildingId, period] as const,
  unit: (unitId: number, period: string) => ["payments", "unit", unitId, period] as const,
};
