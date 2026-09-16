import { useQuery } from "@tanstack/react-query";
import {
  getNotice,
  getNoticeSendSummary,
  listNotices,
  NOTICE_PAGE_SIZE,
  type NoticeFilters,
} from "./apis";
import { noticeKeys } from "./keys";

export function useNotices(
  filters: NoticeFilters = {},
  page = 0,
  pageSize = NOTICE_PAGE_SIZE,
) {
  return useQuery({
    queryKey: noticeKeys.list(filters, page, pageSize),
    queryFn: () => listNotices(filters, page, pageSize),
  });
}

export function useNotice(id: number) {
  return useQuery({
    queryKey: noticeKeys.detail(id),
    queryFn: () => getNotice(id),
    enabled: id > 0,
  });
}

export function useNoticeSendSummary(noticeId: number) {
  return useQuery({
    queryKey: noticeKeys.sendSummary(noticeId),
    queryFn: () => getNoticeSendSummary(noticeId),
    enabled: noticeId > 0,
  });
}
