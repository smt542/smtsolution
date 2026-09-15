import type { JSONContent } from "@tiptap/core";
import { renderJSONContentToReactElement } from "@tiptap/static-renderer/json/react";

import {
  NOTICE_LINK_REL,
  NOTICE_LINK_TARGET,
  sanitizeNoticeHref,
  type NoticeDoc,
} from "@/lib/notice/richText";

import styles from "./noticeRichText.module.css";

/**
 * 공지 본문 읽기 전용 렌더러.
 *
 * - Tiptap JSON을 정적으로 React 엘리먼트로 변환한다. DOM에 의존하지 않아 서버 컴포넌트
 *   (입주자 앱·공유 링크)와 클라이언트(관리자 상세) 양쪽에서 동일하게 동작한다.
 * - 편집기와 동일한 노드/마크 집합만 처리하고, 링크는 `@/lib/notice/richText`의 허용 스킴으로
 *   다시 새니타이즈한다(익명 공유 페이지 방어). 저장된 HTML을 innerHTML로 렌더하지 않는다.
 * - `json`이 없으면 레거시 plain text(`fallbackText`)를 줄바꿈을 보존해 안전하게 표시한다.
 */
const renderNoticeDoc = renderJSONContentToReactElement({
  nodeMapping: {
    doc: ({ children }) => <>{children}</>,
    paragraph: ({ children }) => <p>{children}</p>,
    heading: ({ node, children }) => {
      const Tag = node.attrs?.level === 3 ? "h3" : "h2";
      return <Tag>{children}</Tag>;
    },
    bulletList: ({ children }) => <ul>{children}</ul>,
    orderedList: ({ children }) => <ol>{children}</ol>,
    listItem: ({ children }) => <li>{children}</li>,
    blockquote: ({ children }) => <blockquote>{children}</blockquote>,
    hardBreak: () => <br />,
    text: ({ node }) => node.text ?? "",
  },
  markMapping: {
    bold: ({ children }) => <strong>{children}</strong>,
    italic: ({ children }) => <em>{children}</em>,
    link: ({ mark, children }) => {
      const href = sanitizeNoticeHref(mark.attrs?.href);
      if (!href) return <>{children}</>;
      return (
        <a href={href} target={NOTICE_LINK_TARGET} rel={NOTICE_LINK_REL}>
          {children}
        </a>
      );
    },
  },
  // 스키마 밖 노드/마크는 자식 텍스트만 남겨 안전하게 무시한다.
  unhandledNode: ({ children }) => <>{children}</>,
  unhandledMark: ({ children }) => <>{children}</>,
});

export function NoticeContent({
  json,
  fallbackText,
  className,
}: {
  json?: NoticeDoc | null;
  fallbackText?: string | null;
  className?: string;
}) {
  const rootClass = [styles.root, className].filter(Boolean).join(" ");

  if (json && typeof json === "object") {
    return <div className={rootClass}>{renderNoticeDoc({ content: json as JSONContent })}</div>;
  }

  return <div className={`${rootClass} ${styles.plain}`}>{fallbackText ?? ""}</div>;
}
