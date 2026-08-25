"use client";

import { useMutation } from "@tanstack/react-query";

import { mintSettlementShareToken } from "./apis";

export function useMintSettlementShareToken() {
  return useMutation({
    mutationFn: (settlementId: number) =>
      mintSettlementShareToken(settlementId),
  });
}
