import type { ComplaintFilters } from "./apis";

export const complaintKeys = {
  all: ["complaints"] as const,
  list: (filters: ComplaintFilters = {}) =>
    [
      "complaints",
      "list",
      filters.buildingId ?? null,
      filters.categoryId ?? null,
      [...(filters.statuses ?? [])].sort(),
      filters.receivedFrom ?? "",
      filters.receivedTo ?? "",
      filters.search ?? "",
    ] as const,
  one: (id: number) => ["complaints", "detail", id] as const,
  resolutions: (complaintId: number) =>
    ["complaints", "resolutions", complaintId] as const,
  partnerDetail: (complaintId: number | null) =>
    ["complaints", "partner", "detail", complaintId] as const,
  partnerUnits: (buildingId: number | null) =>
    ["complaints", "partner", "units", buildingId] as const,
};
