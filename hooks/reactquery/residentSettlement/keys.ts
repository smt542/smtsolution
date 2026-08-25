export const residentSettlementShareKeys = {
  all: ["residentSettlementShare"] as const,
  publicDetails: () => ["residentSettlementShare", "public"] as const,
  publicDetail: (token: string) =>
    ["residentSettlementShare", "public", token] as const,
};
