import type { JSONContent } from "@tiptap/core";

import {
  MAX_ATTACHMENT_FILES,
  normalizeAttachmentFileName,
  selectImageFiles,
  type FileSelectionResult,
} from "@/lib/attachments/policy";
import type { NoticeDoc } from "@/lib/notice/richText";

/**
 * 공지 본문 이미지의 프레임워크 비종속 순수 로직.
 *
 * - image 노드는 공개 URL이 아니라 private Storage object path(`path` attr)만 저장한다.
 * - 저장(create/update) 시점에만 실제 업로드하고, content_json 안의 임시 노드(`pendingId`)를
 *   업로드된 object path로 치환한다(고아 최소화: 저장 전에는 Storage에 아무것도 남기지 않음).
 * - 표시 시점에 path를 signed URL로 해석한다(클라이언트=RLS, 서버=service_role 스코프 서명).
 */

/** Tiptap image 노드 타입. StarterKit에는 image가 없으므로 커스텀 노드가 이 이름을 소유한다. */
export const NOTICE_IMAGE_NODE_TYPE = "image";
/** 공지 본문 이미지 첨부의 entity_type. 공지 첨부는 이 값으로만 식별한다. */
export const NOTICE_IMAGE_ENTITY_TYPE = "notice";
/** 공통 attachments enum을 확장하지 않기 위해 기존 값을 재사용한다. */
export const NOTICE_IMAGE_KIND = "etc";
/** 공통 첨부와 동일한 private bucket. */
export const NOTICE_ATTACHMENTS_BUCKET = "attachments";

/** object path 형태: `{orgId}/notice/{segment}/{file}` (4 세그먼트, 첫 세그먼트=orgId). */
const NOTICE_IMAGE_PATH_RE = /^(\d+)\/notice\/[^/]+\/[^/]+$/;

/**
 * 공지 이미지 object path인지 검사한다. 외부 URL·`data:`·상대경로·타 org 경로를 차단한다.
 * `orgId`를 주면 첫 세그먼트가 해당 org와 일치하는지까지 확인한다(교차 org 서명 방지).
 */
export function isNoticeImagePath(path: unknown, orgId?: number): path is string {
  if (typeof path !== "string") return false;
  const match = NOTICE_IMAGE_PATH_RE.exec(path.trim());
  if (!match) return false;
  if (orgId != null && match[1] !== String(orgId)) return false;
  return true;
}

/** 새 이미지의 저장 경로를 만든다. notice id에 의존하지 않아 create/update 모두에서 쓸 수 있다. */
export function buildNoticeImagePath(params: {
  orgId: number;
  fileName: string;
  uniqueId?: string;
}): string {
  const folder = params.uniqueId ?? crypto.randomUUID();
  const file = `${crypto.randomUUID()}-${normalizeAttachmentFileName(params.fileName)}`;
  return `${params.orgId}/${NOTICE_IMAGE_ENTITY_TYPE}/${folder}/${file}`;
}

function walkNoticeNodes(
  doc: NoticeDoc | null | undefined,
  visit: (node: JSONContent) => void,
): void {
  if (!doc || typeof doc !== "object") return;
  const stack: JSONContent[] = [doc as JSONContent];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    visit(node);
    const children = node.content;
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child && typeof child === "object") stack.push(child);
      }
    }
  }
}

/** content_json이 참조하는 저장된 이미지 object path 목록(중복 제거). */
export function collectNoticeImagePaths(doc: NoticeDoc | null | undefined): string[] {
  const paths = new Set<string>();
  walkNoticeNodes(doc, (node) => {
    if (node.type === NOTICE_IMAGE_NODE_TYPE) {
      const path = node.attrs?.path;
      if (typeof path === "string" && path) paths.add(path);
    }
  });
  return [...paths];
}

/** 아직 업로드되지 않은(pendingId만 있는) 이미지 노드의 pendingId 목록. */
export function collectPendingNoticeImageIds(doc: NoticeDoc | null | undefined): string[] {
  const ids = new Set<string>();
  walkNoticeNodes(doc, (node) => {
    if (node.type === NOTICE_IMAGE_NODE_TYPE) {
      const pendingId = node.attrs?.pendingId;
      const path = node.attrs?.path;
      if (typeof pendingId === "string" && pendingId && !path) ids.add(pendingId);
    }
  });
  return [...ids];
}

/** image 노드가 하나라도 있으면 true(텍스트가 없어도 빈 문서가 아니라고 판정하는 데 쓴다). */
export function hasNoticeImageNode(doc: NoticeDoc | null | undefined): boolean {
  let found = false;
  walkNoticeNodes(doc, (node) => {
    if (node.type === NOTICE_IMAGE_NODE_TYPE) found = true;
  });
  return found;
}

/**
 * 업로드 결과를 content_json에 반영한다.
 * - `resolved`(pendingId→path)에 있는 노드는 `path`로 치환하고 `pendingId`를 제거한다.
 * - 끝내 해석되지 않은 pending 노드(업로드 실패·File 누락)는 제거한다(blob 전용 노드 저장 방지).
 * 원본 doc은 변형하지 않고 새 문서를 반환한다.
 */
export function applyUploadedNoticeImages(
  doc: NoticeDoc,
  resolved: ReadonlyMap<string, string>,
): NoticeDoc {
  const transform = (node: JSONContent): JSONContent | null => {
    if (node.type === NOTICE_IMAGE_NODE_TYPE) {
      const pendingId = node.attrs?.pendingId;
      const path = node.attrs?.path;
      if (typeof pendingId === "string" && pendingId && !path) {
        const resolvedPath = resolved.get(pendingId);
        if (resolvedPath) {
          const attrs = { ...(node.attrs ?? {}) };
          delete attrs.pendingId;
          return { ...node, attrs: { ...attrs, path: resolvedPath } };
        }
        return null;
      }
    }
    if (Array.isArray(node.content)) {
      const content = node.content
        .map((child) => (child && typeof child === "object" ? transform(child) : child))
        .filter((child): child is JSONContent => child != null);
      return { ...node, content };
    }
    return node;
  };
  const result = transform(doc as JSONContent);
  return (result ?? { type: "doc", content: [{ type: "paragraph" }] }) as NoticeDoc;
}

/**
 * 편집기에서 선택한 이미지 파일을 공통 정책(개수 10·장당 10MB·JPEG/PNG/WebP)으로 검증한다.
 * 문서에 이미 있는 이미지 수를 슬롯 계산에 반영한다.
 */
export function selectNoticeImageFiles(
  currentImageCount: number,
  selected: readonly File[],
): FileSelectionResult {
  const placeholders = Array.from(
    { length: Math.max(0, currentImageCount) },
    () => null as unknown as File,
  );
  return selectImageFiles(placeholders, selected, MAX_ATTACHMENT_FILES);
}

export { MAX_ATTACHMENT_FILES };
