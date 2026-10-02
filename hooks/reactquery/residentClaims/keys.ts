import type { ResidentClaimStatus } from "./apis";

export const residentClaimKeys = {
  all: ["residentClaims"] as const,
  automatch: () => ["residentClaims", "automatch"] as const,
  myLink: () => ["residentClaims", "myLink"] as const,
  pendingContact: () => ["residentClaims", "pendingContact"] as const,
  lists: () => ["residentClaims", "list"] as const,
  list: (status?: ResidentClaimStatus) => [
    "residentClaims",
    "list",
    status ?? "all",
  ] as const,
  buildingSearch: (q?: string) => ["residentClaims", "buildingSearch", q ?? ""] as const,
};
