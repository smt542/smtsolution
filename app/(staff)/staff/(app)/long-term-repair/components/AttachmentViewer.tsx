"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/common";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { attachmentSignedUrl, type Attachment } from "@/hooks/reactquery/attachments";
import styles from "./long-term-repair.module.css";

interface AttachmentViewerProps {
  title: string;
  description: string;
  kindLabel: string;
  attachments: Attachment[];
  canEdit: boolean;
  uploading: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
  onDelete: (attachment: Attachment) => Promise<void>;
}

interface ViewableAttachment {
  attachment: Attachment;
  signedUrl: string;
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
  const fileRef = useRef<HTMLInputElement>(null);
  const attachmentKey = attachments.map((attachment) => attachment.id).join(",");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ViewableAttachment | null>(null);
  const [resolved, setResolved] = useState<{ key: string; items: ViewableAttachment[] }>({
    key: "",
    items: [],
  });
  const loading = resolved.key !== attachmentKey;
  const viewable = loading ? [] : resolved.items;

  useEffect(() => {
    let active = true;
    Promise.all(attachments.map(async (attachment) => ({
      attachment,
      signedUrl: await attachmentSignedUrl(attachment.fileUrl),
    }))).then((items) => {
      if (active) setResolved({ key: attachmentKey, items });
    }).catch((error: unknown) => {
      if (active) {
        setResolved({ key: attachmentKey, items: [] });
        toast.error(error instanceof Error ? error.message : "첨부파일을 열지 못했습니다.");
      }
    });
    return () => { active = false; };
  }, [attachmentKey, attachments]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (preview) setPreview(null);
      else onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [onClose, preview]);

  const uploadFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      await onUpload(file);
    }
  };

  return (
    <>
      <div className={`${styles.attachmentScrim} print:hidden`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}>
        <div className={styles.attachmentModal}>
          <header className={styles.attachmentHeader}>
            <div>
              <h2 className={styles.attachmentTitle}>{title}</h2>
              <p className={styles.attachmentDescription}>{description}</p>
            </div>
            <div className={styles.attachmentHeaderSpacer} />
            <button type="button" aria-label="첨부 뷰어 닫기" onClick={onClose} className={styles.attachmentClose}>✕</button>
          </header>
          <div className={styles.attachmentBody}>
            <section className={styles.attachmentSection}>
              <div className={styles.attachmentSectionHeader}>
                <b>{kindLabel}</b>
                <span>{attachments.length}장</span>
              </div>
              {loading ? (
                <div className="flex h-11 items-center justify-center"><Spinner /></div>
              ) : (
                <div className={styles.attachmentGrid}>
                {viewable.map(({ attachment, signedUrl }, index) => (
                  <figure key={attachment.id} className={styles.attachmentThumb} onClick={() => setPreview({ attachment, signedUrl })}>
                      {/* Signed storage URLs are runtime values and should bypass next/image host allowlists. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={signedUrl} alt={`${title} ${index + 1}`} />
                      {canEdit && (
                        <button
                          type="button"
                          className={styles.attachmentRemove}
                          aria-label={`${attachment.fileName} 삭제`}
                          onClick={async (event) => {
                            event.stopPropagation();
                            const ok = await confirm({ title: "첨부파일 삭제", description: "첨부파일을 삭제할까요?", confirmLabel: "삭제", variant: "danger" });
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
                  {attachments.length ? "수정을 누르면 파일을 올리거나 지울 수 있어요." : "수정을 누르면 파일을 올리거나 지울 수 있어요. 첨부된 파일이 없어요"}
                </p>
              )}
              {canEdit && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    aria-label={`${kindLabel} 이미지 첨부`}
                    onChange={(event) => {
                      if (event.target.files) void uploadFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className={`${styles.attachmentDrop} ${dragging ? styles.attachmentDropActive : ""}`}
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      void uploadFiles(event.dataTransfer.files);
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 16V4" />
                      <path d="m7 9 5-5 5 5" />
                      <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
                    </svg>
                    <span>{uploading ? "올리는 중…" : `${kindLabel} 올리기`}</span>
                  </button>
                </>
              )}
            </section>
          </div>
          <footer className={styles.attachmentFooter}>
            <span className={styles.attachmentNote}>
              {canEdit ? "이미지 파일만 첨부할 수 있어요" : "조회 전용이에요 · 첨부는 수정 상태에서 가능합니다"}
            </span>
            <div className={styles.attachmentFooterSpacer} />
            {viewable.length > 0 && (
              <button type="button" className={styles.attachmentAction} onClick={() => window.print()} disabled={loading}>인쇄</button>
            )}
            <button type="button" className={`${styles.attachmentAction} ${styles.attachmentActionPrimary}`} onClick={onClose}>
              {canEdit ? "완료" : "닫기"}
            </button>
          </footer>
        </div>
      </div>

      {preview && (
        <button type="button" className={`${styles.attachmentPreview} print:hidden`} onClick={() => setPreview(null)} aria-label="확대 이미지 닫기">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.signedUrl} alt={preview.attachment.fileName} />
        </button>
      )}

      <section className="hidden bg-white text-black print:block" aria-label={`${title} 인쇄물`}>
        <h1 className="mb-6 border-b-2 border-black pb-3 text-center text-2xl font-black">{title}</h1>
        <div className="space-y-8">
          {viewable.map(({ attachment, signedUrl }, index) => (
            <figure key={attachment.id} className="break-after-page last:break-after-auto">
              <div className="relative mx-auto h-[240mm] w-[180mm]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={signedUrl} alt={`${title} ${index + 1}`} className="h-full w-full object-contain" />
              </div>
              <figcaption className="mt-2 text-center text-xs">{index + 1}/{viewable.length} · {attachment.fileName}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </>
  );
}
