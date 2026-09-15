import type { Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

import { NOTICE_LINK_REL, NOTICE_LINK_TARGET, isNoticeAllowedHref } from "@/lib/notice/richText";

import { NoticeImage } from "./NoticeImage";

/**
 * 공지 편집기 확장 구성(단일 기준).
 *
 * 허용 노드/마크는 최소 toolbar와 1:1 대응한다:
 * 문단·제목(H2·H3)·굵게·기울임·글머리 목록·번호 목록·인용·링크·본문 이미지·실행취소/다시실행.
 * 범위 밖(코드·코드블록·취소선·밑줄·수평선)은 비활성화해 저장되는 JSON 스키마를 좁히고,
 * 읽기 전용 렌더러가 처리해야 하는 타입을 편집기와 동일하게 유지한다.
 *
 * 링크 보안 정책(허용 스킴·rel·target)은 `@/lib/notice/richText`가 단일 기준이며
 * 편집기 입력 검증(`isAllowedUri`)과 렌더러의 href 새니타이즈가 함께 사용한다.
 *
 * image 노드는 커스텀 `NoticeImage`가 담당한다. 저장 전 File을 담는 공유 맵(`pendingFiles`)이
 * 필요하므로 상수 배열이 아니라 팩토리로 구성한다.
 */
export function createNoticeEditorExtensions(options: {
  pendingFiles: Map<string, File>;
}): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      code: false,
      codeBlock: false,
      strike: false,
      underline: false,
      horizontalRule: false,
      link: {
        autolink: false,
        openOnClick: false,
        defaultProtocol: "https",
        protocols: ["mailto", "tel"],
        HTMLAttributes: {
          rel: NOTICE_LINK_REL,
          target: NOTICE_LINK_TARGET,
        },
        // http/https/mailto/tel 만 허용하고 javascript:, data: 등은 차단한다.
        isAllowedUri: (url) => isNoticeAllowedHref(url),
      },
    }),
    NoticeImage.configure({ pendingFiles: options.pendingFiles }),
  ];
}
