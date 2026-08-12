// hooks/reactquery/buildingVendors/keys.ts
export const buildingVendorKeys = {
  all: ["buildingVendors"] as const,
  byBuilding: (id: number) => ["buildingVendors", id] as const,
};
