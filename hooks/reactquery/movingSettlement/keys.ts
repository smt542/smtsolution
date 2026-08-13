export const movingSettlementKeys = {
  all: ["movingSettlement"] as const,
  context: (unitId: number | null) =>
    ["movingSettlement", "context", unitId] as const,
  list: (buildingId: number | null, from: string, to: string) =>
    ["movingSettlement", "list", buildingId, from, to] as const,
};
