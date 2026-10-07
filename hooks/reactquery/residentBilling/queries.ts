"use client";

import { useQuery } from "@tanstack/react-query";

import { residentBillDetail, residentBillMonths, staffSignBillUrls } from "./apis";
import { residentBillingKeys } from "./keys";

export function useResidentBillMonths() {
  return useQuery({
    queryKey: residentBillingKeys.months(),
    queryFn: residentBillMonths,
  });
}

export function useResidentBillDetail(period: string) {
  return useQuery({
    queryKey: residentBillingKeys.detail(period),
    queryFn: () => residentBillDetail(period),
    enabled: Boolean(period),
  });
}

/**
 * 세대별 공개 고지서 서명 링크(종이 고지서 QR용). 서명에 발급일이 들어가 30일간 유효하므로
 * 하루 안에서는 같은 값을 재사용한다. 부과 확정 전 세대는 결과에서 빠진다.
 */
export function useStaffSignedBillLinks(period: string, unitIds: number[], enabled = true) {
  return useQuery({
    queryKey: residentBillingKeys.staffSignedLinks(period, unitIds),
    queryFn: () => staffSignBillUrls({ period, unitIds }),
    enabled: enabled && Boolean(period) && unitIds.length > 0,
    staleTime: 60 * 60 * 1000,
  });
}
