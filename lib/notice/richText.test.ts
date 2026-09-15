import { describe, expect, it } from "vitest";

import {
  EMPTY_NOTICE_DOC,
  isNoticeAllowedHref,
  noticeDocIsEmpty,
  noticeDocToPlainText,
  plainTextToNoticeDoc,
  sanitizeNoticeHref,
  type NoticeDoc,
} from "./richText";

describe("noticeDocToPlainText", () => {
  it("텍스트 블록마다 줄바꿈을 넣어 평문으로 투영한다", () => {
    const doc: NoticeDoc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "공지 제목" }] },
        { type: "paragraph", content: [{ type: "text", text: "첫째 줄" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "항목1" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "항목2" }] }] },
          ],
        },
      ],
    };
    expect(noticeDocToPlainText(doc)).toBe("공지 제목\n첫째 줄\n항목1\n항목2");
  });

  it("hardBreak를 줄바꿈으로 처리한다", () => {
    const doc: NoticeDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "a" }, { type: "hardBreak" }, { type: "text", text: "b" }],
        },
      ],
    };
    expect(noticeDocToPlainText(doc)).toBe("a\nb");
  });

  it("빈 문서는 빈 문자열로 투영하고 비어 있음으로 판정한다", () => {
    expect(noticeDocToPlainText(EMPTY_NOTICE_DOC)).toBe("");
    expect(noticeDocIsEmpty(EMPTY_NOTICE_DOC)).toBe(true);
    expect(noticeDocIsEmpty(null)).toBe(true);
  });
});

describe("plainTextToNoticeDoc", () => {
  it("레거시 평문을 문단 문서로 변환하고 왕복을 보존한다", () => {
    const doc = plainTextToNoticeDoc("첫째 줄\n둘째 줄");
    expect(doc.content?.length).toBe(2);
    expect(noticeDocToPlainText(doc)).toBe("첫째 줄\n둘째 줄");
  });

  it("빈 평문은 빈 문단 문서가 된다", () => {
    expect(noticeDocIsEmpty(plainTextToNoticeDoc(""))).toBe(true);
    expect(noticeDocIsEmpty(plainTextToNoticeDoc(null))).toBe(true);
  });
});

describe("링크 허용 정책", () => {
  it("http/https/mailto/tel만 허용한다", () => {
    expect(isNoticeAllowedHref("https://example.com")).toBe(true);
    expect(isNoticeAllowedHref("http://example.com")).toBe(true);
    expect(isNoticeAllowedHref("mailto:a@b.com")).toBe(true);
    expect(isNoticeAllowedHref("tel:+82101234")).toBe(true);
  });

  it("javascript: 등 위험한 스킴과 상대 경로를 차단한다", () => {
    expect(isNoticeAllowedHref("javascript:alert(1)")).toBe(false);
    expect(isNoticeAllowedHref("  javascript:alert(1)")).toBe(false);
    expect(isNoticeAllowedHref("data:text/html,x")).toBe(false);
    expect(isNoticeAllowedHref("/relative")).toBe(false);
    expect(isNoticeAllowedHref("")).toBe(false);
    expect(isNoticeAllowedHref(undefined)).toBe(false);
  });

  it("sanitizeNoticeHref는 허용값만 정규화하고 나머지는 null", () => {
    expect(sanitizeNoticeHref("  https://a.com ")).toBe("https://a.com");
    expect(sanitizeNoticeHref("javascript:alert(1)")).toBeNull();
  });
});
