// hooks/reactquery/buildings/keys.ts
export const buildingKeys = {
  all: ["buildings"] as const,
  list: (p?: unknown) => ["buildings", "list", p ?? {}] as const,
  full: (id: number) => ["buildings", "full", id] as const,
  staffOptions: () => ["buildings", "staffOptions"] as const,
  directory: () => ["buildings", "directory"] as const,
};
