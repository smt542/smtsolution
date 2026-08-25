"use client";

import { useQuery } from "@tanstack/react-query";

import { publicSettlementByToken } from "./apis";
import { residentSettlementShareKeys } from "./keys";

export function usePublicSettlementByToken(token: string) {
  return useQuery({
    queryKey: residentSettlementShareKeys.publicDetail(token),
    queryFn: () => publicSettlementByToken(token),
    enabled: Boolean(token),
  });
}
