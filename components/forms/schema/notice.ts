import { z } from "zod";
import { nullableDateTime } from "./common";

export const NOTICE_TYPES = ["normal", "important", "urgent"] as const;
export const NOTICE_PUBLISH_MODES = ["now", "scheduled", "draft"] as const;

export function createNoticeFormSchema(now = new Date()) {
  return z.object({
    target: z.string().refine(
      (value) => value === "organization" || /^\d+$/.test(value) && Number(value) > 0,
      "공지 대상을 선택해 주세요",
    ).transform((value) => value === "organization" ? null : Number(value)),
    noticeType: z.enum(NOTICE_TYPES),
    title: z.string().trim().min(1, "제목을 입력해 주세요").max(200, "제목은 200자 이하로 입력해 주세요"),
    content: z.string().trim().min(1, "내용을 입력해 주세요").max(10_000, "내용은 10,000자 이하로 입력해 주세요"),
    publishMode: z.enum(NOTICE_PUBLISH_MODES),
    scheduledAt: nullableDateTime("예약 게시 일시를 확인해 주세요"),
    expiresAt: nullableDateTime("게시 종료 일시를 확인해 주세요"),
  }).superRefine((value, ctx) => {
    if (value.publishMode === "scheduled") {
      if (!value.scheduledAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledAt"],
          message: "예약 게시 일시를 입력해 주세요",
        });
      } else if (new Date(value.scheduledAt).getTime() <= now.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledAt"],
          message: "예약 게시 일시는 현재 이후로 선택해 주세요",
        });
      }
    }

    if (value.publishMode !== "draft" && value.expiresAt) {
      const publishTime = value.publishMode === "scheduled" && value.scheduledAt
        ? new Date(value.scheduledAt).getTime()
        : now.getTime();
      if (new Date(value.expiresAt).getTime() <= publishTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["expiresAt"],
          message: "게시 종료 일시는 게시 일시 이후로 선택해 주세요",
        });
      }
    }
  });
}

export const noticeFormSchema = createNoticeFormSchema();
export type NoticeFormInput = z.input<typeof noticeFormSchema>;
export type NoticeFormValues = z.output<typeof noticeFormSchema>;
