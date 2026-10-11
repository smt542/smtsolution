import { useQuery } from "@tanstack/react-query";
import {
  getNotice,
  getNoticeSendSummaries,
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

/** 공지 목록의 알림톡 열용 일괄 발송 요약(공지 id → 최근 발송 1건). */
export function useNoticeSendSummaries(noticeIds: readonly number[]) {
  return useQuery({
    queryKey: noticeKeys.sendSummariesOf(noticeIds),
    queryFn: () => getNoticeSendSummaries(noticeIds),
    enabled: noticeIds.length > 0,
  });
}
