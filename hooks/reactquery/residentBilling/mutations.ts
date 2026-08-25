"use client";

import { useMutation } from "@tanstack/react-query";

import {
  residentGetOrCreateBillToken,
  staffMintBillTokens,
  type StaffMintBillTokensPayload,
} from "./apis";

export function useCreateBillToken() {
  return useMutation({
    mutationFn: (period: string) => residentGetOrCreateBillToken(period),
  });
}

export function useStaffMintBillTokens() {
  return useMutation({
    mutationFn: (payload: StaffMintBillTokensPayload) =>
      staffMintBillTokens(payload),
  });
}
