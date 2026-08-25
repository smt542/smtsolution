"use client";

import { useQuery } from "@tanstack/react-query";

import { publicNoticeByToken } from "./apis";
import { residentNoticeShareKeys } from "./keys";

export function usePublicNoticeByToken(token: string) {
  return useQuery({
    queryKey: residentNoticeShareKeys.publicDetail(token),
    queryFn: () => publicNoticeByToken(token),
    enabled: Boolean(token),
  });
}
