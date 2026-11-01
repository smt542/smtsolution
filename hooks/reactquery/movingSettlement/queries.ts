import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getPartnerSettlementFeeItems,
  getSettlementBillingUnpaid,
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

/**
 * 입력 중인 퇴실일 기준 미납 소계. 퇴실일·세대·입주 정보가 없으면 조회하지 않는다(컨텍스트 값 사용).
 * 퇴실일이 바뀌면 키가 달라져 다시 조회한다.
 */
export function useSettlementBillingUnpaid(
  unitId: number | null,
  occupancyId: number | null,
  moveOut: string | null,
  partner = false,
  enabled = true,
) {
  return useQuery({
    queryKey: movingSettlementKeys.billingUnpaid(unitId, occupancyId, moveOut, partner),
    queryFn: () =>
      getSettlementBillingUnpaid(unitId as number, occupancyId as number, moveOut, partner),
    enabled: enabled && unitId !== null && occupancyId !== null && Boolean(moveOut),
    placeholderData: keepPreviousData,
  });
}
