export const setupConfigKeys = { all: ["setupConfig"] as const, detail: (orgId?: number) => ["setupConfig", "detail", orgId ?? null] as const };
