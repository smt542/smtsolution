export const paymentKeys = {
  all: ["payments"] as const,
  rows: (buildingId: number, period: string) => ["payments", "rows", buildingId, period] as const,
  unit: (unitId: number, period: string) => ["payments", "unit", unitId, period] as const,
  receiver: (paymentId: number) => ["payments", "receiver", paymentId] as const,
  statementDates: (buildingId: number, startPeriod: string, endPeriod: string) =>
    ["payments", "statement-dates", buildingId, startPeriod, endPeriod] as const,
  bank: (buildingId: number | null, period: string) => ["payments", "bank", buildingId, period] as const,
  giro: (buildingId: number | null, period: string) => ["payments", "giro", buildingId, period] as const,
  giroDetails: (period: string) => ["payments", "giro-details", period] as const,
  paidDate: (year: number, month: number) => ["payments", "paid-date", year, month] as const,
};
