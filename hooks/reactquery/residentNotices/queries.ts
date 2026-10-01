"use client";

import { useQuery } from "@tanstack/react-query";

import {
  residentBuildingNotice,
  residentNoticeDetail,
  residentNoticeReadIds,
  residentNotices,
} from "./apis";
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

export function useResidentNoticeReadIds() {
  return useQuery({
    queryKey: residentNoticeKeys.readIds(),
    queryFn: residentNoticeReadIds,
  });
}

export function useResidentBuildingNotice() {
  return useQuery({
    queryKey: residentNoticeKeys.buildingNotice(),
    queryFn: residentBuildingNotice,
  });
}
