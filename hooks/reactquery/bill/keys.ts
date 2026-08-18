export const billKeys = {
  all: ["bill"] as const,
  targets: (buildingId: number, period: string) => ["bill", "targets", buildingId, period] as const,
  documents: (buildingId: number, period: string, unitIds: number[]) => ["bill", "documents", buildingId, period, unitIds] as const,
  organization: (orgId: number) => ["bill", "organization", orgId] as const,
};
