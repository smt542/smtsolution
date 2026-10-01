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

export function getNoticeCreatorLabel(
  notice: Pick<Notice, "createdBy" | "createdByName">,
): string {
  return notice.createdByName ?? (notice.createdBy ? "작성자 미상" : "-");
}

export const NOTICE_STATUS_LABELS: Record<Exclude<NoticeStatus, "all">, string> = {
  draft: "초안",
  scheduled: "예약",
  published: "게시 중",
  expired: "종료",
};

export type PublishMode = "now" | "scheduled" | "draft";

/**
 * 공지 대상 건물 선택 상태(정본 notice-management `.nc-blds`).
 * "all" = 전체 건물, 배열 = 켠 건물(빈 배열 = 선택 없음). 저장값은 빈 배열이 전체 공지다.
 */
export type NoticeTargetSelection = "all" | number[];

export function toNoticeTargetSelection(buildingIds: number[]): NoticeTargetSelection {
  return buildingIds.length === 0 ? "all" : buildingIds;
}

/** 전체 건물 칩 상태: 전체 선택이거나 건물이 모두 켜져 있으면 켜진다. */
export function isAllNoticeTargets(
  selection: NoticeTargetSelection,
  buildings: ReadonlyArray<{ id: number }>,
): boolean {
  if (selection === "all") return true;
  const ids = new Set(selection);
  return buildings.length > 0 && buildings.every((building) => ids.has(building.id));
}

/** 저장할 buildingIds: 모두 켜져 있으면 전체 공지([]), 하나도 안 켜져 있으면 null. */
export function toNoticeBuildingIds(
  selection: NoticeTargetSelection,
  buildings: ReadonlyArray<{ id: number }>,
): number[] | null {
  if (selection === "all" || isAllNoticeTargets(selection, buildings)) return [];
  return selection.length > 0 ? selection : null;
}

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
