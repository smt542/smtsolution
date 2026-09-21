export const occupancyKeys = {
  all: ["occupancies"] as const,
  tenantList: (buildingId: number) => ["occupancies", "tenants", buildingId] as const,
  tenantCardPrint: (buildingId: number) => ["occupancies", "tenant-card-print", buildingId] as const,
  full: (unitId: number) => ["occupancies", "full", unitId] as const,
  byUnit: (unitId: number) => ["occupancies", "unit", unitId] as const,
};
