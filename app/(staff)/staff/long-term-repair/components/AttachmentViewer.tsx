"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Spinner } from "@/components/common";
import { attachmentSignedUrl, type Attachment } from "@/hooks/reactquery/attachments";

interface AttachmentViewerProps {
  title: string;
  attachments: Attachment[];
  canDelete: boolean;
  onClose: () => void;
  onDelete: (attachment: Attachment) => Promise<void>;
}

interface ViewableAttachment {
  attachment: Attachment;
  signedUrl: string;
}

export function AttachmentViewer({
  title,
  attachments,
  canDelete,
  onClose,
  onDelete,
}: AttachmentViewerProps) {
  const attachmentKey = attachments.map((attachment) => attachment.id).join(",");
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
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden" role="dialog" aria-modal="true" aria-label={`${title} 첨부 뷰어`}>
        <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-surface shadow-pop">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="text-lg font-extrabold text-t1">{title}</h2>
              <p className="mt-1 text-xs text-t3">{attachments.length}장</p>
            </div>
            <button type="button" aria-label="첨부 뷰어 닫기" onClick={onClose} className="h-9 w-9 rounded-full text-xl text-t3 hover:bg-bg">×</button>
          </header>
          <div className="min-h-60 flex-1 overflow-y-auto bg-bg p-5">
            {loading ? (
              <div className="flex min-h-60 items-center justify-center"><Spinner /></div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {viewable.map(({ attachment, signedUrl }, index) => (
                  <figure key={attachment.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                    <a href={signedUrl} target="_blank" rel="noreferrer" className="relative block aspect-[4/3] bg-slate-100">
                      {/* Signed storage URLs are runtime values and should bypass next/image host allowlists. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={signedUrl} alt={`${title} ${index + 1}`} className="h-full w-full object-contain" />
                    </a>
                    <figcaption className="flex items-center gap-2 p-3 text-xs">
                      <span className="min-w-0 flex-1 truncate text-t2">{attachment.fileName}</span>
                      {canDelete && (
                        <button
                          type="button"
                          className="font-bold text-red"
                          onClick={async () => {
                            if (!window.confirm("첨부파일을 삭제할까요?")) return;
                            await onDelete(attachment);
                          }}
                        >
                          삭제
                        </button>
                      )}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
          <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <Button type="button" variant="ghost" onClick={onClose}>닫기</Button>
            <Button type="button" onClick={() => window.print()} disabled={loading || viewable.length === 0}>인쇄</Button>
          </footer>
        </div>
      </div>

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
