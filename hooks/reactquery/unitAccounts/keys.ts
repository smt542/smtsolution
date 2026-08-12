export const unitAccountKeys = { all: ["unitAccounts"] as const, byUnit: (id: number) => ["unitAccounts", id] as const };
