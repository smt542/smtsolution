export const feeItemKeys = {
  all: ["feeItems"] as const,
  list: (typeId: number) => ["feeItems", "list", typeId] as const,
  lookup: (filters: import("./apis").FeeItemLookupFilters) =>
    ["feeItems", "lookup", filters] as const,
};
