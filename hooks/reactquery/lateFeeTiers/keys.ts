export const lateFeeTierKeys = {
  all: ["lateFeeTiers"] as const,
  list: (orgId: number) => ["lateFeeTiers", "list", orgId] as const,
};
