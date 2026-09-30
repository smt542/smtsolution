"use client";
import { useState } from "react";
import { FormGrid } from "@/components/common/FormGrid";
import { FieldRenderer } from "../ui/FieldRenderer";
import { PhotoUpload } from "../ui/PhotoUpload";
import { TextAreaField } from "../ui/TextAreaField";
import { TextField } from "../ui/TextField";
import { VendorNameField } from "../ui/VendorNameField";
import type { FieldDef } from "../config/types";
import type { RegisterVendorEntry } from "../config/formState";
import {
  useAttachmentSignedUrls,
  type Attachment,
} from "@/hooks/reactquery/attachments";
import type { Vendor } from "@/hooks/reactquery/vendors";

/** 업체명 드롭다운 목록 = 협력업체 관리에서 아코디언 제목과 같은 구분의 업체. null = 맞는 구분이 없어 직접 입력만 한다. */
export interface VendorNameOptions {
  loading: boolean;
  vendors: Vendor[];
}

const NAME = "업체명";
const PHONE = "전화번호";
const ACCOUNT = "계좌번호";

/** 한 업체 아코디언의 펼침 내용(제어형): 필드 그리드 + 계약서 사진(저장된 사진과 새 사진을 한 줄에) + 비고. */
export function VendorCard({
  fields,
  value,
  onChange,
  nameOptions,
  attachments = [],
  onDeleteAttachment,
  disabled = false,
}: {
  fields: FieldDef[];
  value: RegisterVendorEntry;
  onChange: (next: RegisterVendorEntry) => void;
  nameOptions: VendorNameOptions | null;
  attachments?: Attachment[];
  onDeleteAttachment?: (attachment: Attachment) => Promise<void>;
  disabled?: boolean;
}) {
  const thumbnails = useAttachmentSignedUrls(attachments, "thumbnail");
  const previews = useAttachmentSignedUrls(attachments, "preview");
  const setField = (label: string, v: string) => onChange({ ...value, fields: { ...value.fields, [label]: v } });
  const setVendorFields = (next: Record<string, string>) => onChange({ ...value, fields: { ...value.fields, ...next } });

  // 정본: 업체를 고르면 전화번호·계좌번호를 채우고 잠근다, 직접입력이면 셋 다 비우고 직접 쓴다.
  // 고른 적이 없으면 저장된 업체명이 목록에 없을 때만 직접입력으로 본다(목록을 받는 동안은 잠금).
  const [chosenMode, setChosenMode] = useState<"pick" | "manual" | null>(null);
  const name = value.fields[NAME] ?? "";
  const vendorsByName = new Map((nameOptions?.vendors ?? []).map((vendor) => [vendor.name, vendor] as const));
  const manual =
    nameOptions === null
      ? true
      : chosenMode
        ? chosenMode === "manual"
        : !nameOptions.loading && name !== "" && !vendorsByName.has(name);

  return (
    <FormGrid>
      {fields.map((f) => {
        if (f.kind === "vendorName") {
          if (nameOptions === null) {
            return (
              <TextField key={f.label} label={f.label} placeholder={f.label} value={name} onChange={(v) => setField(f.label, v)} />
            );
          }
          return (
            <VendorNameField
              key={f.label}
              label={f.label}
              placeholder={f.placeholder}
              names={[...vendorsByName.keys()]}
              manual={manual}
              value={name}
              onPick={(picked) => {
                const vendor = vendorsByName.get(picked);
                setChosenMode("pick");
                setVendorFields({ [NAME]: picked, [PHONE]: vendor?.phone ?? "", [ACCOUNT]: vendor?.bankAccount ?? "" });
              }}
              onManual={() => {
                setChosenMode("manual");
                setVendorFields({ [NAME]: "", [PHONE]: "", [ACCOUNT]: "" });
              }}
              onNameChange={(v) => setField(f.label, v)}
            />
          );
        }
        if (f.kind === "vendorContact") {
          return (
            <TextField
              key={f.label}
              label={f.label}
              placeholder={f.placeholder}
              value={value.fields[f.label] ?? ""}
              onChange={(v) => setField(f.label, v)}
              readOnly={!manual}
              mask={manual ? f.mask : undefined}
            />
          );
        }
        return <FieldRenderer key={f.label} field={f} value={value.fields[f.label]} onChange={(v) => setField(f.label, v)} />;
      })}
      <PhotoUpload
        label="계약서 사진"
        files={value.pendingFiles}
        onFilesChange={(pendingFiles) => onChange({ ...value, pendingFiles })}
        existing={thumbnails.map(({ attachment, url, error }, index) => ({
          id: attachment.id,
          name: attachment.fileName,
          url,
          error: Boolean(error),
          onOpen: url ? () => window.open(previews[index]?.url ?? url, "_blank", "noopener,noreferrer") : undefined,
          onDelete: onDeleteAttachment ? () => onDeleteAttachment(attachment) : undefined,
        }))}
        max={Math.max(0, 10 - attachments.length)}
        totalMax={10}
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
