export const unitKeys = {
  all: ["units"] as const,
  one: (id: number) => ["units", id] as const,
  byBuilding: (buildingId: number) => ["units", "building", buildingId] as const,
};
