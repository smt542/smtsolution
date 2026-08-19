"use client";

import { useMutation } from "@tanstack/react-query";

import { residentGetOrCreateBillToken } from "./apis";

export function useCreateBillToken() {
  return useMutation({
    mutationFn: (period: string) => residentGetOrCreateBillToken(period),
  });
}
