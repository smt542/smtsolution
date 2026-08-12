export const occupancyKeys = {
  all: ["occupancies"] as const,
  tenantList: (buildingId: number) => ["occupancies", "tenants", buildingId] as const,
  full: (unitId: number) => ["occupancies", "full", unitId] as const,
};
