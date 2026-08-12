import type { NoticeFilters } from "./apis";

export const noticeKeys = {
  all: ["notices"] as const,
  lists: () => [...noticeKeys.all, "list"] as const,
  list: (filters: NoticeFilters = {}) => [...noticeKeys.lists(), filters] as const,
  details: () => [...noticeKeys.all, "detail"] as const,
  detail: (id: number) => [...noticeKeys.details(), id] as const,
};
