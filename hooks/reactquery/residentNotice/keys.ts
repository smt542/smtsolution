export const residentNoticeShareKeys = {
  all: ["residentNoticeShare"] as const,
  publicDetails: () => ["residentNoticeShare", "public"] as const,
  publicDetail: (token: string) =>
    ["residentNoticeShare", "public", token] as const,
};
