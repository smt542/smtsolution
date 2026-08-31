export const feeItemKeys = {
  all: ["feeItems"] as const,
  list: (typeId: number) => ["feeItems", "list", typeId] as const,
  management: () => ["feeItems", "management"] as const,
  lookup: (filters: import("./apis").FeeItemLookupFilters) =>
    ["feeItems", "lookup", filters] as const,
};
