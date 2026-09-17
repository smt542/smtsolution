"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/common";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { useAppToast } from "@/hooks/common";
import {
  useAttachmentSignedUrls,
  type Attachment,
  type AttachmentUploadBatchResult,
} from "@/hooks/reactquery/attachments";
import { selectImageFiles } from "@/lib/attachments/policy";
import { longTermRepairClasses as styles } from "./longTermRepairClasses";

interface AttachmentViewerProps {
  title: string;
  description: string;
  kindLabel: string;
  attachments: Attachment[];
  canEdit: boolean;
  uploading: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => Promise<AttachmentUploadBatchResult>;
  onDelete: (attachment: Attachment) => Promise<void>;
}

export function AttachmentViewer({
  title,
  description,
  kindLabel,
  attachments,
  canEdit,
  uploading,
  onClose,
  onUpload,
  onDelete,
}: AttachmentViewerProps) {
  const confirm = useConfirm();
  const appToast = useAppToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const thumbnailResults = useAttachmentSignedUrls(attachments, "thumbnail");
  const previewResults = useAttachmentSignedUrls(attachments, "preview");
  const originalResults = useAttachmentSignedUrls(attachments, "original");
  const areThumbnailsLoading = thumbnailResults.some((item) => item.isPending);
  const areOriginalsLoading = originalResults.some((item) => item.isPending);
  const printable = originalResults.filter((item) => item.url);
  const previewUrl = preview
    ? previewResults.find((item) => item.attachment.id === preview.id)?.url
    : null;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || uploading) return;
      if (preview) setPreview(null);
      else onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [onClose, preview, uploading]);

  const uploadFiles = async (selected: FileList | readonly File[]) => {
    const { accepted, errors } = selectImageFiles(
      [],
      Array.from(selected),
      Math.max(0, 10 - attachments.length),
    );
    if (errors.length > 0) appToast.error(errors.join("\n"));
    if (accepted.length === 0) return;

    try {
      const result = await onUpload(accepted);
      const nextFailedFiles = result.failed.map(({ file }) => file);
      setFailedFiles(nextFailedFiles);
      if (nextFailedFiles.length > 0) {
        appToast.warning(
          `${result.succeeded.length}장은 저장했고 ${nextFailedFiles.length}장은 실패했습니다. 실패한 사진만 다시 시도해 주세요.`,
        );
      } else {
        appToast.success(`${result.succeeded.length}장의 사진을 첨부했습니다.`);
      }
    } catch (error) {
      setFailedFiles(accepted);
      appToast.error(error, "사진을 첨부하지 못했습니다.");
    }
  };

  return (
    <>
      <div
        className={`${styles.attachmentScrim} print:hidden`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => {
          if (!uploading && event.currentTarget === event.target) onClose();
        }}
      >
        <div className={styles.attachmentModal}>
          <header className={styles.attachmentHeader}>
            <div>
              <h2 className={styles.attachmentTitle}>{title}</h2>
              <p className={styles.attachmentDescription}>{description}</p>
            </div>
            <div className={styles.attachmentHeaderSpacer} />
            <button
              type="button"
              aria-label="첨부 뷰어 닫기"
              onClick={onClose}
              disabled={uploading}
              className={styles.attachmentClose}
            >
              ✕
            </button>
          </header>
          <div className={styles.attachmentBody}>
            <section className={styles.attachmentSection}>
              <div className={styles.attachmentSectionHeader}>
                <b>{kindLabel}</b>
                <span>{attachments.length}장</span>
              </div>
            {areThumbnailsLoading ? (
                <div className="flex h-11 items-center justify-center"><Spinner label="첨부 사진 불러오는 중" /></div>
              ) : (
                <div className={styles.attachmentGrid}>
                  {thumbnailResults.map(({ attachment, url, error }, index) => (
                    <figure key={attachment.id} className={styles.attachmentThumb}>
                      {url ? (
                        <button
                          type="button"
                          className="size-full"
                          onClick={() => setPreview(attachment)}
                          aria-label={`${attachment.fileName} 크게 보기`}
                        >
                          <Image
                            src={url}
                            alt={`${title} ${index + 1}`}
                            fill
                            unoptimized
                            sizes="(max-width: 768px) 33vw, 180px"
                            className="object-cover"
                          />
                        </button>
                      ) : (
                        <span
                          role={error ? "alert" : "status"}
                          aria-label={error ? `${attachment.fileName} 불러오기 실패` : `${attachment.fileName} 불러오는 중`}
                          className="flex size-full items-center justify-center p-2 text-center text-xs text-danger"
                        >
                          {error ? "이 사진을 불러오지 못했습니다." : "불러오는 중…"}
                        </span>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          className={styles.attachmentRemove}
                          aria-label={`${attachment.fileName} 삭제`}
                          disabled={uploading}
                          onClick={async (event) => {
                            event.stopPropagation();
                            const ok = await confirm({
                              title: "첨부파일 삭제",
                              description: "첨부파일을 삭제할까요?",
                              confirmLabel: "삭제",
                              variant: "danger",
                            });
                            if (!ok) return;
                            await onDelete(attachment);
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </figure>
                  ))}
                </div>
              )}
              {!canEdit && (
                <p className={styles.attachmentReadOnly}>
                  {attachments.length
                    ? "수정을 누르면 파일을 올리거나 지울 수 있어요."
                    : "수정을 누르면 파일을 올리거나 지울 수 있어요. 첨부된 파일이 없어요"}
                </p>
              )}
              {canEdit && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    aria-label={`${kindLabel} 이미지 첨부`}
                    disabled={uploading || attachments.length >= 10}
                    onChange={(event) => {
                      if (event.target.files) void uploadFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className={`${styles.attachmentDrop} ${dragging ? styles.attachmentDropActive : styles.attachmentDropIdle}`}
                    disabled={uploading || attachments.length >= 10}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      if (!uploading) void uploadFiles(event.dataTransfer.files);
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 16V4" />
                      <path d="m7 9 5-5 5 5" />
                      <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
                    </svg>
                    <span>{uploading ? "올리는 중…" : `${kindLabel} 올리기`}</span>
                  </button>
                  {failedFiles.length > 0 ? (
                    <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
                      <p>{failedFiles.map((file) => file.name).join(", ")}</p>
                      <button
                        type="button"
                        className="mt-2 font-bold underline"
                        disabled={uploading}
                        onClick={() => void uploadFiles(failedFiles)}
                      >
                        실패한 사진 다시 시도
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </div>
          <footer className={styles.attachmentFooter}>
            <span className={styles.attachmentNote}>
              {canEdit ? "JPG, PNG, WEBP 이미지만 첨부할 수 있어요" : "조회 전용이에요 · 첨부는 수정 상태에서 가능합니다"}
            </span>
            <div className={styles.attachmentFooterSpacer} />
            {printable.length > 0 && (
              <button
                type="button"
                className={`${styles.attachmentAction} ${styles.attachmentActionNeutral}`}
                onClick={() => window.print()}
                disabled={areOriginalsLoading}
              >
                {areOriginalsLoading ? "인쇄 자료 준비 중…" : "인쇄"}
              </button>
            )}
            <button
              type="button"
              className={`${styles.attachmentAction} ${styles.attachmentActionPrimary}`}
              onClick={onClose}
              disabled={uploading}
            >
              {canEdit ? "완료" : "닫기"}
            </button>
          </footer>
        </div>
      </div>

      {preview && previewUrl && (
        <button type="button" className={`${styles.attachmentPreview} print:hidden`} onClick={() => setPreview(null)} aria-label="확대 이미지 닫기">
          <Image
            src={previewUrl}
            alt={preview.fileName}
            fill
            unoptimized
            sizes="100vw"
            className="object-contain"
          />
        </button>
      )}

      <section className="hidden bg-white text-black print:block" aria-label={`${title} 인쇄물`}>
        <h1 className="mb-6 border-b-2 border-black pb-3 text-center text-2xl font-black">{title}</h1>
        <div className="space-y-8">
          {printable.map(({ attachment, url }, index) => (
            <figure key={attachment.id} className="break-after-page last:break-after-auto">
              <div className="relative mx-auto h-[240mm] w-[180mm]">
                <Image
                  src={url ?? ""}
                  alt={`${title} ${index + 1}`}
                  fill
                  unoptimized
                  loading="eager"
                  sizes="180mm"
                  className="h-full w-full object-contain"
                />
              </div>
              <figcaption className="mt-2 text-center text-xs">{index + 1}/{printable.length} · {attachment.fileName}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </>
  );
}
