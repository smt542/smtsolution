import Image from "next/image";
import type { JSONContent } from "@tiptap/core";
import { renderJSONContentToReactElement } from "@tiptap/static-renderer/json/react";

import {
  NOTICE_LINK_REL,
  NOTICE_LINK_TARGET,
  sanitizeNoticeHref,
  type NoticeDoc,
} from "@/lib/notice/richText";

import {
  noticeImageClassName,
  noticeImageStateClassName,
  noticeRichTextClassName,
} from "./richTextClasses";

/**
 * 공지 본문 읽기 전용 렌더러.
 *
 * - Tiptap JSON을 정적으로 React 엘리먼트로 변환한다. DOM에 의존하지 않아 서버 컴포넌트
 *   (입주자 앱·공유 링크)와 클라이언트(관리자 상세) 양쪽에서 동일하게 동작한다.
 * - 편집기와 동일한 노드/마크 집합만 처리하고, 링크는 `@/lib/notice/richText`의 허용 스킴으로
 *   다시 새니타이즈한다(익명 공유 페이지 방어). 저장된 HTML을 innerHTML로 렌더하지 않는다.
 * - image 노드는 저장된 object path를 그대로 표시하지 않는다. 상위(호출부)가 path→signed URL
 *   맵을 미리 해석해 넘기면(`imageUrls`) 그 URL로 렌더하고, 없으면 로딩/대체 표시를 한다.
 * - `json`이 없으면 레거시 plain text(`fallbackText`)를 줄바꿈을 보존해 안전하게 표시한다.
 */

function NoticeImageView({
  path,
  alt,
  url,
  loading,
}: {
  path: string | null;
  alt: string;
  url?: string;
  loading: boolean;
}) {
  if (!path) return null;
  if (url) {
    return (
      <Image
        src={url}
        alt={alt}
        width={800}
        height={600}
        unoptimized
        className={noticeImageClassName}
        style={{ width: "auto", height: "auto" }}
      />
    );
  }
  if (loading) {
    return (
      <span className={noticeImageStateClassName} role="status" aria-label="이미지 불러오는 중">
        이미지 불러오는 중…
      </span>
    );
  }
  return (
    <span className={noticeImageStateClassName} role="img" aria-label={alt || "이미지를 불러올 수 없어요"}>
      이미지를 불러올 수 없어요
    </span>
  );
}

// imageUrls/loading을 노드 매핑이 닫아 쓰도록 호출마다 렌더러를 만든다(base 매핑은 컨텍스트 타이핑 유지).
function buildRenderer(imageUrls: Record<string, string> | undefined, loading: boolean) {
  return renderJSONContentToReactElement({
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
      image: ({ node }) => {
        const path =
          typeof node.attrs?.path === "string" && node.attrs.path ? node.attrs.path : null;
        const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
        return (
          <NoticeImageView
            path={path}
            alt={alt}
            url={path ? imageUrls?.[path] : undefined}
            loading={loading}
          />
        );
      },
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
}

export function NoticeContent({
  json,
  fallbackText,
  className,
  imageUrls,
  imageUrlsLoading = false,
}: {
  json?: NoticeDoc | null;
  fallbackText?: string | null;
  className?: string;
  /** image 노드 object path → signed URL. 호출부가 표시 직전에 해석해 넘긴다. */
  imageUrls?: Record<string, string>;
  /** 이미지 URL을 아직 해석 중이면 로딩 표시(클라이언트 비동기 서명 경로). */
  imageUrlsLoading?: boolean;
}) {
  const rootClass = [noticeRichTextClassName, className].filter(Boolean).join(" ");

  if (json && typeof json === "object") {
    const render = buildRenderer(imageUrls, imageUrlsLoading);
    return <div className={rootClass}>{render({ content: json as JSONContent })}</div>;
  }

  return <div className={`${rootClass} whitespace-pre-wrap`}>{fallbackText ?? ""}</div>;
}
