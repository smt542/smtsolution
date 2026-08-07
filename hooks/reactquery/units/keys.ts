export const unitKeys = {
  all: ["units"] as const,
  list: (buildingId: number) => ["units", "list", buildingId] as const,
  one: (id: number) => ["units", id] as const,
};
