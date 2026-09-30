"use client";

import { useQuery } from "@tanstack/react-query";

import { getPartnerMyPin } from "./apis";
import { partnerProfileKeys } from "./keys";

// 눈 버튼을 켰을 때만 불러오고, 화면을 떠나면 캐시에서 바로 지운다(gcTime 0).
export function usePartnerMyPin(enabled: boolean) {
  return useQuery({
    queryKey: partnerProfileKeys.myPin(),
    queryFn: getPartnerMyPin,
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
