export const billingKeys = {
  all: ["billing"] as const,
  list: (buildingId: number, period: string) => ["billing", "list", buildingId, period] as const,
  history: (unitId: number, period: string) => ["billing", "history", unitId, period] as const,
  periodSetting: (buildingId: number, period: string) => ["billing", "period-setting", buildingId, period] as const,
};
