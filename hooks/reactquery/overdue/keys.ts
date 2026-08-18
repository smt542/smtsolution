import type { OverdueScope } from "./apis";

export const overdueKeys = {
  all: ["overdue"] as const,
  buildings: () => ["overdue", "buildings"] as const,
  households: (
    buildingId: number,
    year = new Date().getFullYear(),
    month = new Date().getMonth() + 1,
    scope: OverdueScope = "all",
  ) => ["overdue", "households", buildingId, year, month, scope] as const,
  periods: (
    buildingId: number,
    year = new Date().getFullYear(),
    month = new Date().getMonth() + 1,
    scope: OverdueScope = "all",
  ) => ["overdue", "periods", buildingId, year, month, scope] as const,
};

