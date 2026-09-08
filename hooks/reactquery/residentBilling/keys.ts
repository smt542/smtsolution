export const residentBillingKeys = {
  all: ["residentBilling"] as const,
  months: () => ["residentBilling", "months"] as const,
  details: () => ["residentBilling", "detail"] as const,
  detail: (period: string) => ["residentBilling", "detail", period] as const,
  publicDetails: () => ["residentBilling", "public"] as const,
  publicDetail: (
    buildingId: number,
    unitNo: string,
    period: string,
    sig: string,
  ) => ["residentBilling", "public", buildingId, unitNo, period, sig] as const,
};
