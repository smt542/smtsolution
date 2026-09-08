"use client";

import { useMutation } from "@tanstack/react-query";

import {
  residentSignBillUrl,
  staffSignBillUrls,
  type StaffSignBillUrlsPayload,
} from "./apis";

export function useResidentSignBillUrl() {
  return useMutation({
    mutationFn: (period: string) => residentSignBillUrl(period),
  });
}

export function useStaffSignBillUrls() {
  return useMutation({
    mutationFn: (payload: StaffSignBillUrlsPayload) =>
      staffSignBillUrls(payload),
  });
}
