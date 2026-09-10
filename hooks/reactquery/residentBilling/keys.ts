export const residentBillingKeys = {
  all: ["residentBilling"] as const,
  months: () => ["residentBilling", "months"] as const,
  details: () => ["residentBilling", "detail"] as const,
  detail: (period: string) => ["residentBilling", "detail", period] as const,
};
