export const billingDueSettingKeys = {
  all: ["billingDueSetting"] as const,
  detail: (orgId?: number | null) => ["billingDueSetting", "detail", orgId ?? null] as const,
};
