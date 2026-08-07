export const occupancyKeys = {
  all: ["occupancies"] as const,
  list: (unitId: number) => ["occupancies", "list", unitId] as const,
  one: (id: number) => ["occupancies", id] as const,
};
