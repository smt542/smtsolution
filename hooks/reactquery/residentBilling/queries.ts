"use client";

import { useQuery } from "@tanstack/react-query";

import {
  publicBillBySigned,
  residentBillDetail,
  residentBillMonths,
} from "./apis";
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

export function usePublicBillBySigned(
  buildingId: number,
  unitNo: string,
  period: string,
  sig: string,
) {
  return useQuery({
    queryKey: residentBillingKeys.publicDetail(buildingId, unitNo, period, sig),
    queryFn: () => publicBillBySigned(buildingId, unitNo, period, sig),
    enabled: Boolean(buildingId && unitNo && period && sig),
  });
}
