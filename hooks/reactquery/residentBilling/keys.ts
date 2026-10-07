export const residentBillingKeys = {
  all: ["residentBilling"] as const,
  months: () => ["residentBilling", "months"] as const,
  details: () => ["residentBilling", "detail"] as const,
  detail: (period: string) => ["residentBilling", "detail", period] as const,
  staffSignedLinks: (period: string, unitIds: number[]) =>
    ["residentBilling", "staffSignedLinks", period, [...unitIds].sort((a, b) => a - b)] as const,
};
