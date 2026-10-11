import { NOTICE_PAGE_SIZE, type NoticeFilters } from "./apis";

export const noticeKeys = {
  all: ["notices"] as const,
  lists: () => [...noticeKeys.all, "list"] as const,
  list: (filters: NoticeFilters = {}, page = 0, pageSize = NOTICE_PAGE_SIZE) =>
    [...noticeKeys.lists(), filters, page, pageSize] as const,
  details: () => [...noticeKeys.all, "detail"] as const,
  detail: (id: number) => [...noticeKeys.details(), id] as const,
  sendSummaries: () => [...noticeKeys.all, "send-summaries"] as const,
  sendSummariesOf: (ids: readonly number[]) => [...noticeKeys.sendSummaries(), ids] as const,
  sendSummary: (id: number) => [...noticeKeys.all, "send-summary", id] as const,
};
