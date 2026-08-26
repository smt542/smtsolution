export const billingKeys = {
  all: ["billing"] as const,
  list: (buildingId: number, period: string) => ["billing", "list", buildingId, period] as const,
  histories: () => ["billing", "history"] as const,
  history: (unitId: number, period: string) => [...billingKeys.histories(), unitId, period] as const,
  periodSetting: (buildingId: number, period: string) => ["billing", "period-setting", buildingId, period] as const,
  newOccupancies: (buildingId: number, period: string) => ["billing", "new-occ", buildingId, period] as const,
};
