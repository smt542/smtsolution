// hooks/reactquery/buildings/keys.ts
export const buildingKeys = {
  all: ["buildings"] as const,
  lists: () => ["buildings", "list"] as const,
  list: (p?: unknown) => ["buildings", "list", p ?? {}] as const,
  full: (id: number) => ["buildings", "full", id] as const,
  staffOptions: () => ["buildings", "staffOptions"] as const,
  deleteImpact: (id: number) => ["buildings", "deleteImpact", id] as const,
  directory: () => ["buildings", "directory"] as const,
  codeTaken: (code: string, excludeId?: number) => ["buildings", "codeTaken", code, excludeId ?? 0] as const,
  nextCode: () => ["buildings", "nextCode"] as const,
};
