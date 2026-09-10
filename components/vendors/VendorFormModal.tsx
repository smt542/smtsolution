"use client";
import React, { useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Modal } from "@/components/common";
import { vendorSchema } from "@/components/forms/schema/vendor";
import type { Vendor } from "@/hooks/reactquery/vendors";
import type { VendorAttachment } from "@/hooks/reactquery/vendors";
import type { VendorCategory } from "@/hooks/reactquery/vendorCategories";
import styles from "./VendorManagement.module.css";

// Use z.input so form fields stay as strings/null before Zod coercion
type VendorFormInput = z.input<typeof vendorSchema>;
type VendorFormOutput = z.output<typeof vendorSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editing: Vendor | null;
  defaultCategoryId?: number | null;
  categories: VendorCategory[];
  onSubmit: (values: VendorFormOutput) => Promise<void>;
  isPending: boolean;
  onDeleteVendor?: (id: number) => Promise<void>;
  // Attachment props (only used when editing an existing vendor)
  attachments?: VendorAttachment[];
  onUploadAttachment?: (file: File) => Promise<void>;
  onDeleteAttachment?: (attachment: VendorAttachment) => Promise<void>;
}

export function VendorFormModal({
  open,
  onClose,
  editing,
  defaultCategoryId = null,
  categories,
  onSubmit,
  isPending,
  onDeleteVendor,
  attachments = [],
  onUploadAttachment,
  onDeleteAttachment,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categoryOptions = [
    { value: "", label: "구분 없음" },
    ...categories.map((c) => ({ value: String(c.id), label: c.label })),
  ];

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VendorFormInput, unknown, VendorFormOutput>({
    resolver: zodResolver(vendorSchema),
    defaultValues: editing
      ? {
          name: editing.name,
          phone: editing.phone ?? "",
          bankAccount: editing.bankAccount ?? "",
          memo: editing.memo ?? "",
          categoryId: editing.categoryId ?? null,
        }
      : { name: "", phone: "", bankAccount: "", memo: "", categoryId: defaultCategoryId },
  });

  React.useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              name: editing.name,
              phone: editing.phone ?? "",
              bankAccount: editing.bankAccount ?? "",
              memo: editing.memo ?? "",
              categoryId: editing.categoryId ?? null,
            }
          : { name: "", phone: "", bankAccount: "", memo: "", categoryId: defaultCategoryId }
      );
    }
  }, [open, editing, defaultCategoryId, reset]);

  const onValid = async (values: VendorFormOutput) => {
    await onSubmit(values);
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const remaining = Math.max(0, 10 - attachments.length);
    const files = Array.from(e.target.files ?? []).slice(0, remaining);
    if (files.length === 0 || !onUploadAttachment) return;
    for (const file of files) {
      await onUploadAttachment(file);
    }
    // Reset file input so the same file can be re-uploaded if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "업체 수정" : "업체 추가"}
      className={styles.dialog}
      overlayClassName="z-[320] bg-[rgba(23,31,40,.5)] p-6"
    >
      <button type="button" onClick={onClose} className={styles.closeButton} aria-label="닫기">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      <form onSubmit={handleSubmit(onValid)}>
        {/* 구분 (category) */}
        <div className={styles.formCategory}>
          <label className={styles.fieldLabel}>구분</label>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <select
                value={field.value != null ? String(field.value) : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  field.onChange(v === "" ? null : Number(v));
                }}
                className={styles.fieldSelect}
                aria-label="구분"
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            )}
          />
        </div>

        <div className={styles.formBody}>
          <div className={styles.formGrid}>
            {/* 업체명 (required) */}
            <div>
              <label className={styles.fieldLabel}>업체명</label>
              <input
                {...register("name")}
                placeholder="업체명"
                className={styles.fieldInput}
              />
              {errors.name && (
                <p className={styles.fieldError}>{errors.name.message}</p>
              )}
            </div>

            {/* 전화 */}
            <div>
              <label className={styles.fieldLabel}>전화번호</label>
              <input {...register("phone")} placeholder="전화번호" className={`${styles.fieldInput} num`} />
            </div>

            {/* 계좌번호 */}
            <div className={styles.fullField}>
              <label className={styles.fieldLabel}>계좌번호</label>
              <input {...register("bankAccount")} placeholder="계좌번호" className={styles.fieldInput} />
            </div>

            {/* 계약서 사진 */}
            <div className={`${styles.fullField} ${styles.attachments}`}>
              <label className={styles.fieldLabel}>
                계약서 사진 <span className="font-semibold text-t4">(최대 10장)</span>
              </label>

              {attachments.length > 0 && (
                <ul className={styles.attachmentList}>
                  {attachments.map((att) => (
                    <li key={att.id} className={styles.attachmentItem}>
                      <span className={styles.attachmentName}>{att.fileName}</span>
                      {onDeleteAttachment && (
                        <button
                          type="button"
                          aria-label={`${att.fileName} 삭제`}
                          onClick={() => onDeleteAttachment(att)}
                          className={styles.attachmentDelete}
                        >
                          삭제
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {editing && onUploadAttachment ? (
                <label className={styles.fileButton}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  사진 추가
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={handleFileChange}
                    aria-label="계약서 사진 업로드"
                  />
                </label>
              ) : (
                <p className={styles.fileHelp}>새 업체는 저장 후 사진을 첨부할 수 있습니다.</p>
              )}
            </div>

            {/* 비고 */}
            <div className={styles.fullField}>
              <label className={styles.fieldLabel}>비고</label>
              <textarea {...register("memo")} placeholder="비고" className={styles.fieldTextarea} />
            </div>
          </div>
        </div>

        <div className={styles.formFooter}>
          {editing && onDeleteVendor ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className={`${styles.footerButton} ${styles.deleteButton}`}
            >
              삭제
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isPending}
            className={`${styles.footerButton} ${styles.submitButton}`}
          >
            {isPending ? "저장 중…" : editing ? "수정" : "추가"}
          </button>
        </div>
      </form>

      {/* Delete confirm modal */}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="업체 삭제"
        className="max-w-[360px] rounded-[20px] shadow-hf-modal"
        overlayClassName="z-[340] bg-[rgba(23,31,40,.5)] p-6"
      >
        <p className="text-[13.5px] font-semibold leading-[1.6] text-t3">
          ‘<b className="font-bold text-t1">{editing?.name}</b>’ 업체를 삭제합니다. 삭제하면 되돌릴 수 없어요.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
            취소
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={async () => {
              if (!editing || !onDeleteVendor) return;
              setConfirmDelete(false);
              onClose();
              await onDeleteVendor(editing.id);
            }}
          >
            삭제
          </Button>
        </div>
      </Modal>
    </Modal>
  );
}
