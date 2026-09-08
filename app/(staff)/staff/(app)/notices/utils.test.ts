import { describe, expect, it } from "vitest";
import {
  getNoticeStatus,
  getNoticeTemplateTitle,
  toDateTimeLocal,
  validateNoticeForm,
} from "./utils";

const now = new Date("2026-08-12T03:00:00.000Z");

describe("notice utils", () => {
  it.each([
    ["normal", "공지 안내(신규)"],
    ["important", "공지 안내(중요)"],
    ["urgent", "공지 안내(긴급)"],
  ] as const)("%s 공지를 정확한 알림톡 템플릿 제목으로 매핑", (noticeType, title) => {
    expect(getNoticeTemplateTitle(noticeType)).toBe(title);
  });

  it.each([
    [{ publishedAt: null, expiresAt: null }, "draft"],
    [{ publishedAt: "2026-08-13T03:00:00.000Z", expiresAt: null }, "scheduled"],
    [{ publishedAt: "2026-08-11T03:00:00.000Z", expiresAt: null }, "published"],
    [{ publishedAt: "2026-08-10T03:00:00.000Z", expiresAt: "2026-08-12T02:59:00.000Z" }, "expired"],
  ] as const)("게시 일시로 %s 상태를 계산", (notice, expected) => {
    expect(getNoticeStatus(notice, now)).toBe(expected);
  });

  it("예약 게시 일시는 현재 이후여야 함", () => {
    expect(validateNoticeForm({
      title: "제목",
      content: "내용",
      publishMode: "scheduled",
      scheduledAt: "2026-08-12T02:00:00.000Z",
      expiresAt: "",
      now,
    })).toMatch(/현재 이후/);
  });

  it("종료 일시는 게시 일시 이후여야 함", () => {
    expect(validateNoticeForm({
      title: "제목",
      content: "내용",
      publishMode: "scheduled",
      scheduledAt: "2026-08-13T03:00:00.000Z",
      expiresAt: "2026-08-13T02:00:00.000Z",
      now,
    })).toMatch(/게시 일시 이후/);
  });

  it("datetime-local 값은 로컬 날짜 형식으로 변환", () => {
    expect(toDateTimeLocal("invalid")).toBe("");
    expect(toDateTimeLocal("2026-08-12T03:04:00.000Z")).toMatch(/^2026-08-12T\d{2}:04$/);
  });
});
