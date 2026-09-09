import type { StaffMoveOutFilters } from "./apis";

export const staffMoveOutKeys = {
  all: ["staff-move-out"] as const,
  list: (filters: StaffMoveOutFilters = {}) =>
    [
      "staff-move-out",
      "list",
      filters.buildingId ?? null,
      [...(filters.statuses ?? [])].sort(),
      filters.sort ?? "created_desc",
    ] as const,
};
