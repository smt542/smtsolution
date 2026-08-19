"use client";

import { useQuery } from "@tanstack/react-query";

import {
  publicBillByToken,
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

export function usePublicBillByToken(token: string) {
  return useQuery({
    queryKey: residentBillingKeys.publicDetail(token),
    queryFn: () => publicBillByToken(token),
    enabled: Boolean(token),
  });
}
