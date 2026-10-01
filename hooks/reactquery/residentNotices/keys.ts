export const residentNoticeKeys = {
  all: ["residentNotices"] as const,
  lists: () => ["residentNotices", "list"] as const,
  list: () => ["residentNotices", "list"] as const,
  details: () => ["residentNotices", "detail"] as const,
  detail: (id: number) => ["residentNotices", "detail", id] as const,
  readIds: () => ["residentNotices", "read-ids"] as const,
  buildingNotice: () => ["residentNotices", "building-notice"] as const,
};
