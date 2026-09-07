"use client";

import { useMutation } from "@tanstack/react-query";

import {
  residentGetOrCreateBillToken,
  staffMintBillTokens,
  staffRevokeBillToken,
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

export function useStaffRevokeBillToken() {
  return useMutation({
    mutationFn: (token: string) => staffRevokeBillToken(token),
  });
}
