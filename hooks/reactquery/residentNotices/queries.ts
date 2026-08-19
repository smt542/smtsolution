"use client";

import { useQuery } from "@tanstack/react-query";

import { residentNoticeDetail, residentNotices } from "./apis";
import { residentNoticeKeys } from "./keys";

export function useResidentNotices() {
  return useQuery({
    queryKey: residentNoticeKeys.list(),
    queryFn: residentNotices,
  });
}

export function useResidentNoticeDetail(id: number) {
  return useQuery({
    queryKey: residentNoticeKeys.detail(id),
    queryFn: () => residentNoticeDetail(id),
    enabled: Number.isInteger(id) && id > 0,
  });
}
