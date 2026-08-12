import { useQuery } from "@tanstack/react-query";
import { getNotice, listNotices, type NoticeFilters } from "./apis";
import { noticeKeys } from "./keys";

export function useNotices(filters: NoticeFilters = {}) {
  return useQuery({
    queryKey: noticeKeys.list(filters),
    queryFn: () => listNotices(filters),
  });
}

export function useNotice(id: number) {
  return useQuery({
    queryKey: noticeKeys.detail(id),
    queryFn: () => getNotice(id),
    enabled: id > 0,
  });
}
