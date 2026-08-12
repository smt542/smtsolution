export const longTermRepairKeys = {
  all: ["longTermRepair"] as const,
  byBuilding: (buildingId: number) => ["longTermRepair", buildingId] as const,
  attachments: (repairId: number) =>
    ["longTermRepair", "attachments", repairId] as const,
};
