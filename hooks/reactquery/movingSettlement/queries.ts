import { useQuery } from "@tanstack/react-query";
import {
  getPartnerSettlementFeeItems,
  getSettlementContext,
  listSettlementInquiries,
  listSettlements,
  type SettlementInquiryParams,
} from "./apis";
import { movingSettlementKeys } from "./keys";

export function useSettlementContext(
  unitId: number | null,
  settlementId: number | null = null,
) {
  return useQuery({
    queryKey: movingSettlementKeys.context(unitId, settlementId),
    queryFn: () => getSettlementContext(unitId as number, settlementId),
    enabled: unitId !== null,
  });
}

/** 파트너 이사정산: 관리비 항목·퇴실월 부과액. unitId·period 가 없으면 조회하지 않는다. */
export function usePartnerSettlementFeeItems(unitId: number | null, period: string | null) {
  return useQuery({
    queryKey: movingSettlementKeys.partnerFeeItems(unitId, period),
    queryFn: () => getPartnerSettlementFeeItems(unitId as number, period as string),
    enabled: unitId !== null && period !== null,
  });
}

export function useSettlementList(
  buildingId: number | null,
  from: string,
  to: string,
) {
  return useQuery({
    queryKey: movingSettlementKeys.list(buildingId, from, to),
    queryFn: () => listSettlements(buildingId as number, from, to),
    enabled: buildingId !== null && from !== "" && to !== "",
  });
}

export function useSettlementInquiry(params: SettlementInquiryParams) {
  return useQuery({
    queryKey: movingSettlementKeys.inquiry(params),
    queryFn: () => listSettlementInquiries(params),
    enabled: params.from !== "" && params.to !== "" && params.from <= params.to,
  });
}
