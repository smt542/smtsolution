import type { SettlementInquiryParams } from "./apis";

export const movingSettlementKeys = {
  all: ["movingSettlement"] as const,
  context: (unitId: number | null, settlementId: number | null = null) =>
    ["movingSettlement", "context", unitId, settlementId] as const,
  list: (buildingId: number | null, from: string, to: string) =>
    ["movingSettlement", "list", buildingId, from, to] as const,
  inquiry: (params: SettlementInquiryParams) =>
    [
      "movingSettlement",
      "inquiry",
      params.type,
      params.buildingId ?? null,
      params.from,
      params.to,
      params.search ?? "",
      params.status ?? null,
      params.sort ?? "date",
      params.page ?? 1,
      params.pageSize ?? 20,
    ] as const,
};
