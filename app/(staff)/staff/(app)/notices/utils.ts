import type { Notice, NoticeStatus, NoticeType } from "@/hooks/reactquery/notices";
import { createNoticeFormSchema } from "@/components/forms/schema/notice";

export const NOTICE_TYPE_LABELS: Record<NoticeType, string> = {
  normal: "신규",
  important: "중요",
  urgent: "긴급",
};

export const NOTICE_TEMPLATE_TITLES: Record<NoticeType, string> = {
  normal: "공지 안내(신규)",
  important: "공지 안내(중요)",
  urgent: "공지 안내(긴급)",
};

export function getNoticeTemplateTitle(noticeType: NoticeType): string {
  return NOTICE_TEMPLATE_TITLES[noticeType];
}

export const NOTICE_STATUS_LABELS: Record<Exclude<NoticeStatus, "all">, string> = {
  draft: "초안",
  scheduled: "예약",
  published: "게시 중",
  expired: "종료",
};

export type PublishMode = "now" | "scheduled" | "draft";

export function getNoticeStatus(
  notice: Pick<Notice, "publishedAt" | "expiresAt">,
  now = new Date(),
): Exclude<NoticeStatus, "all"> {
  if (!notice.publishedAt) return "draft";

  const nowTime = now.getTime();
  const publishedTime = new Date(notice.publishedAt).getTime();
  if (Number.isFinite(publishedTime) && publishedTime > nowTime) return "scheduled";

  const expiresTime = notice.expiresAt ? new Date(notice.expiresAt).getTime() : NaN;
  if (Number.isFinite(expiresTime) && expiresTime <= nowTime) return "expired";
  return "published";
}

export function getPublishMode(
  notice: Pick<Notice, "publishedAt" | "expiresAt">,
  now = new Date(),
): PublishMode {
  const status = getNoticeStatus(notice, now);
  if (status === "draft") return "draft";
  if (status === "scheduled") return "scheduled";
  return "now";
}

export function formatNoticeDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toIsoDateTime(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function validateNoticeForm({
  title,
  content,
  publishMode,
  scheduledAt,
  expiresAt,
  now = new Date(),
}: {
  title: string;
  content: string;
  publishMode: PublishMode;
  scheduledAt: string;
  expiresAt: string;
  now?: Date;
}): string | null {
  const result = createNoticeFormSchema(now).safeParse({
    buildingIds: [],
    noticeType: "normal",
    title,
    content,
    publishMode,
    scheduledAt,
    expiresAt,
  });
  return result.success ? null : result.error.issues[0]?.message ?? "공지 입력값을 확인해 주세요.";
}
