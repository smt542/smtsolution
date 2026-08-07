export const feeItemKeys = {
  all: ["feeItems"] as const,
  list: (typeId: number) => ["feeItems", "list", typeId] as const,
};
