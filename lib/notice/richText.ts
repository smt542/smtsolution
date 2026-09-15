import type { JSONContent } from "@tiptap/core";

/**
 * 공지 본문 리치 텍스트의 프레임워크 비종속 순수 로직.
 *
 * - 저장 원본은 Tiptap JSON(`NoticeDoc`)이다.
 * - 링크 정책(허용 스킴·rel·target)은 이 파일이 단일 기준이며 편집기와 읽기 전용
 *   렌더러가 함께 사용한다.
 * - 레거시 plain text 호환과 `content`(NOT NULL) 컬럼용 평문 투영을 제공한다.
 */
export type NoticeDoc = JSONContent;

/** 외부 링크 보안 정책: 새 탭 + 안전한 rel. 편집기 HTMLAttributes와 렌더러가 공유한다. */
export const NOTICE_LINK_REL = "noopener noreferrer nofollow";
export const NOTICE_LINK_TARGET = "_blank";

/** 허용 링크 스킴: http/https/mailto/tel 만. javascript:, data: 등은 차단한다. */
const ALLOWED_LINK_SCHEME = /^(?:https?|mailto|tel):/i;

/** 허용된 링크 href인지 검사한다(편집기 isAllowedUri·렌더러 새니타이즈 공용). */
export function isNoticeAllowedHref(href: unknown): href is string {
  if (typeof href !== "string") return false;
  const trimmed = href.trim();
  if (!trimmed) return false;
  return ALLOWED_LINK_SCHEME.test(trimmed);
}

/** 허용 href면 정규화한 값을, 아니면 null을 돌려준다(렌더 시 href 제거용). */
export function sanitizeNoticeHref(href: unknown): string | null {
  return isNoticeAllowedHref(href) ? href.trim() : null;
}

/** 빈 문서 기본값(신규 공지 편집기 초기값). */
export const EMPTY_NOTICE_DOC: NoticeDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/**
 * 레거시 plain text를 Tiptap 문서로 변환한다.
 * 일괄 파괴적 변환 없이, 기존 공지를 편집기에서 열 때만 사용한다.
 */
export function plainTextToNoticeDoc(text: string | null | undefined): NoticeDoc {
  const value = (text ?? "").replace(/\r\n?/g, "\n");
  if (!value.trim()) return { type: "doc", content: [{ type: "paragraph" }] };
  const content = value.split("\n").map((line) =>
    line.length > 0
      ? { type: "paragraph", content: [{ type: "text", text: line }] }
      : { type: "paragraph" },
  );
  return { type: "doc", content };
}

// 텍스트를 직접 담는 블록만 줄바꿈을 낸다. blockquote/listItem은 내부 문단이 줄바꿈을 담당한다.
const BLOCK_NODE_TYPES = new Set(["paragraph", "heading"]);

/**
 * Tiptap 문서를 평문으로 투영한다.
 * `content`(NOT NULL) 컬럼, 목록 검색/미리보기, 문자·알림톡 소비 경로가 계속 동작하도록
 * 블록 경계마다 줄바꿈을 넣는다.
 */
export function noticeDocToPlainText(doc: NoticeDoc | null | undefined): string {
  if (!doc || typeof doc !== "object") return "";
  let buffer = "";
  const walk = (node: JSONContent | undefined): void => {
    if (!node) return;
    if (node.type === "text") {
      buffer += node.text ?? "";
      return;
    }
    if (node.type === "hardBreak") {
      buffer += "\n";
      return;
    }
    for (const child of node.content ?? []) walk(child);
    if (node.type && BLOCK_NODE_TYPES.has(node.type)) buffer += "\n";
  };
  walk(doc);
  return buffer.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** 저장 전 빈 문서 검증에 사용한다(텍스트가 전혀 없으면 true). */
export function noticeDocIsEmpty(doc: NoticeDoc | null | undefined): boolean {
  return noticeDocToPlainText(doc).length === 0;
}
