"use client";
import { FormGrid } from "@/components/common/FormGrid";
import { FieldRenderer } from "../ui/FieldRenderer";
import { PhotoUpload } from "../ui/PhotoUpload";
import { TextAreaField } from "../ui/TextAreaField";
import type { FieldDef } from "../config/types";
import type { RegisterVendorEntry } from "../config/formState";
import {
  useAttachmentSignedUrls,
  type Attachment,
} from "@/hooks/reactquery/attachments";

/** 한 업체 아코디언의 펼침 내용(제어형): 필드 그리드 + 계약서 사진 + 비고.
 *  계약서 사진은 프로토타입 동작(로컬 미리보기)만 제공하며 서버 저장 대상이 아니다. */
export function VendorCard({
  fields,
  value,
  onChange,
  attachments = [],
  onDeleteAttachment,
  disabled = false,
}: {
  fields: FieldDef[];
  value: RegisterVendorEntry;
  onChange: (next: RegisterVendorEntry) => void;
  attachments?: Attachment[];
  onDeleteAttachment?: (attachment: Attachment) => Promise<void>;
  disabled?: boolean;
}) {
  const thumbnails = useAttachmentSignedUrls(attachments, "thumbnail");
  const previews = useAttachmentSignedUrls(attachments, "preview");
  const setField = (label: string, v: string) => onChange({ ...value, fields: { ...value.fields, [label]: v } });
  return (
    <FormGrid>
      {fields.map((f) => (
        <FieldRenderer key={f.label} field={f} value={value.fields[f.label]} onChange={(v) => setField(f.label, v)} />
      ))}
      {thumbnails.length > 0 ? (
        <div className="col-span-2 flex gap-2 overflow-x-auto" aria-label="저장된 계약서 사진">
          {thumbnails.map(({ attachment, url, error }, index) => (
            <div key={attachment.id} className="relative size-[84px] shrink-0 overflow-hidden rounded-[10px] border border-line">
              {url ? (
                <button
                  type="button"
                  className="size-full"
                  onClick={() => window.open(previews[index]?.url ?? url, "_blank", "noopener,noreferrer")}
                  aria-label={`${attachment.fileName} 미리보기`}
                >
                  {/* Signed runtime URLs intentionally bypass next/image host allowlists. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="size-full object-cover" />
                </button>
              ) : (
                <span className="flex size-full items-center justify-center p-2 text-center text-[10px] text-t3">
                  {error ? "미리보기 실패" : "불러오는 중…"}
                </span>
              )}
              {onDeleteAttachment ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void onDeleteAttachment(attachment)}
                  className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-xs text-white disabled:opacity-40"
                  aria-label={`${attachment.fileName} 삭제`}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <PhotoUpload
        label="계약서 사진"
        files={value.pendingFiles}
        onFilesChange={(pendingFiles) => onChange({ ...value, pendingFiles })}
        max={Math.max(0, 10 - attachments.length)}
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
      />
      <TextAreaField
        label="비고"
        placeholder="비고를 입력하세요…"
        minHeight={76}
        value={value.memo}
        onChange={(v) => onChange({ ...value, memo: v })}
      />
    </FormGrid>
  );
}
