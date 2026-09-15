"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

import { useObjectUrls } from "@/hooks/common";
import { attachmentSignedUrl } from "@/hooks/reactquery/attachments/apis";
import { attachmentKeys } from "@/hooks/reactquery/attachments/keys";
import {
  SIGNED_URL_GC_TIME_MS,
  SIGNED_URL_STALE_TIME_MS,
} from "@/lib/attachments/signedUrl";
import { NOTICE_IMAGE_NODE_TYPE } from "@/lib/notice/images";

import styles from "../noticeRichText.module.css";

import type { NoticeImageStorage } from "./NoticeImage";

/**
 * 편집기 내 이미지 표시 NodeView.
 * - pending(저장 전): 공유 맵의 File을 blob URL로 미리 본다(공통 useObjectUrls).
 * - 저장본: object path를 staff 세션(RLS)으로 signed URL 서명해 표시한다.
 */
export function NoticeImageNodeView({ node, editor, deleteNode, selected }: NodeViewProps) {
  const path = typeof node.attrs.path === "string" && node.attrs.path ? node.attrs.path : null;
  const pendingId =
    typeof node.attrs.pendingId === "string" && node.attrs.pendingId
      ? node.attrs.pendingId
      : null;
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  const isPending = Boolean(pendingId) && !path;

  const pendingFile = useMemo(() => {
    if (!isPending || !pendingId) return null;
    const storage = (
      editor.storage as unknown as Record<string, NoticeImageStorage | undefined>
    )[NOTICE_IMAGE_NODE_TYPE];
    return storage?.pendingFiles.get(pendingId) ?? null;
  }, [editor, isPending, pendingId]);
  const pendingFileList = useMemo(
    () => (pendingFile ? [pendingFile] : []),
    [pendingFile],
  );
  const blobUrl = useObjectUrls(pendingFileList)[0]?.url ?? null;

  const signed = useQuery({
    queryKey: attachmentKeys.signedUrl(path ?? "", "preview"),
    queryFn: () => attachmentSignedUrl(path as string, { preset: "preview" }),
    enabled: Boolean(path) && !isPending,
    staleTime: SIGNED_URL_STALE_TIME_MS,
    gcTime: SIGNED_URL_GC_TIME_MS,
    retry: 1,
  });

  const displayUrl = blobUrl ?? signed.data ?? null;
  const loading = isPending ? !blobUrl : signed.isPending;
  const failed = !isPending && signed.isError;

  return (
    <NodeViewWrapper
      as="div"
      className={`${styles.imageBlock} ${selected ? styles.imageSelected : ""}`}
    >
      {displayUrl ? (
        // signed/blob URL은 일시적이라 next/image 최적화를 사용하지 않는다.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displayUrl} alt={alt} className={styles.image} />
      ) : failed ? (
        <div className={styles.imageFallback} role="img" aria-label={alt || "이미지를 불러올 수 없어요"}>
          이미지를 불러올 수 없어요
        </div>
      ) : loading ? (
        <div className={styles.imagePlaceholder} role="status" aria-label="이미지 불러오는 중">
          불러오는 중…
        </div>
      ) : (
        <div className={styles.imageFallback} role="img" aria-label={alt || "이미지"}>
          이미지를 불러올 수 없어요
        </div>
      )}
      <button
        type="button"
        className={styles.imageRemove}
        aria-label="이미지 삭제"
        contentEditable={false}
        onClick={() => deleteNode()}
      >
        ✕
      </button>
    </NodeViewWrapper>
  );
}
