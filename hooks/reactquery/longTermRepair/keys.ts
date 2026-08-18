export const longTermRepairKeys = {
  all: ["longTermRepairLedger"] as const,
  byBuilding: (buildingId: number, startMonth: string, endMonth: string) =>
    ["longTermRepairLedger", buildingId, startMonth, endMonth] as const,
  openingBalance: (buildingId: number, startMonth: string) =>
    ["longTermRepairLedger", buildingId, "openingBalance", startMonth] as const,
};
