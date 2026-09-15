"use client";
import React, { useRef, useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Modal, PhotoUpload } from "@/components/common";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { vendorSchema } from "@/components/forms/schema/vendor";
import type { Vendor } from "@/hooks/reactquery/vendors";
import { useAttachmentSignedUrls, type Attachment } from "@/hooks/reactquery/attachments";
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
  onSubmit: (
    values: VendorFormOutput,
    pendingFiles: File[],
  ) => Promise<{ failedFiles: File[] } | void>;
  isPending: boolean;
  onDeleteVendor?: (id: number) => Promise<void>;
  // Attachment props (only used when editing an existing vendor)
  attachments?: Attachment[];
  onDeleteAttachment?: (attachment: Attachment) => Promise<void>;
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
  onDeleteAttachment,
}: Props) {
  const confirm = useConfirm();
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const categoryControlId = React.useId();
  const categoryMenuId = React.useId();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const attachmentPreviews = useAttachmentSignedUrls(attachments, "thumbnail");

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
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

  React.useEffect(() => {
    if (!categoryDropdownOpen) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!categoryDropdownRef.current?.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [categoryDropdownOpen]);

  const selectedCategoryId = useWatch({ control, name: "categoryId" });
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);

  const closeModal = (force = false) => {
    if (!force && (isPending || isSubmitting)) return;
    setPendingPhotos([]);
    setCategoryDropdownOpen(false);
    setConfirmDelete(false);
    onClose();
  };

  const onValid = async (values: VendorFormOutput) => {
    try {
      const result = await onSubmit(values, pendingPhotos);
      if (result?.failedFiles.length) {
        setPendingPhotos(result.failedFiles);
        return;
      }
      closeModal(true);
    } catch {
      // The parent reports the operation error; keep the modal and selected files open.
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => closeModal()}
      title={editing ? "업체 수정" : "업체 추가"}
      className={styles.dialog}
      overlayClassName="z-[320] bg-[rgba(23,31,40,.5)] p-6"
    >
      <button
        type="button"
        onClick={() => closeModal()}
        disabled={isPending || isSubmitting}
        className={styles.closeButton}
        aria-label="닫기"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      <form onSubmit={handleSubmit(onValid)}>
        {/* 구분 (category) */}
        <div className={styles.formCategory}>
          <label htmlFor={categoryControlId} className={styles.fieldLabel}>구분</label>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <div
                ref={categoryDropdownRef}
                className={`${styles.categoryDropdown} ${categoryDropdownOpen ? styles.categoryDropdownOpen : ""} ${selectedCategory ? "" : styles.categoryDropdownPlaceholder}`}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && categoryDropdownOpen) {
                    event.preventDefault();
                    event.stopPropagation();
                    setCategoryDropdownOpen(false);
                  }
                }}
              >
                <button
                  id={categoryControlId}
                  type="button"
                  role="combobox"
                  aria-label="구분"
                  aria-haspopup="listbox"
                  aria-expanded={categoryDropdownOpen}
                  aria-controls={categoryMenuId}
                  className={styles.categoryControl}
                  onClick={() => setCategoryDropdownOpen((current) => !current)}
                >
                  <span className={styles.categoryValue}>{selectedCategory?.label ?? "선택"}</span>
                  <svg className={styles.categoryChevron} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {categoryDropdownOpen ? (
                  <div id={categoryMenuId} role="listbox" aria-label="구분 선택" className={styles.categoryMenu}>
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        role="option"
                        aria-selected={field.value === category.id}
                        className={`${styles.categoryOption} ${field.value === category.id ? styles.categoryOptionSelected : ""}`}
                        onClick={() => {
                          field.onChange(category.id);
                          field.onBlur();
                          setCategoryDropdownOpen(false);
                        }}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          />
        </div>

        <div className={styles.formBody}>
          <div className={styles.formFields}>
            {!selectedCategory ? (
              <p className={styles.categoryHelp}>구분을 먼저 선택하세요.</p>
            ) : (
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
                <div className={styles.fullField}>
                  <label className={styles.fieldLabel}>
                    계약서 사진 <span className="font-semibold text-t4">(최대 10장)</span>
                  </label>

                  {attachments.length > 0 && (
                    <ul className={styles.attachmentList}>
                      {attachmentPreviews.map(({ attachment: att, url, error }) => (
                        <li key={att.id} className={styles.attachmentItem}>
                          {url ? (
                            // Signed runtime URLs intentionally bypass next/image host allowlists.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt="" className="size-10 rounded object-cover" />
                          ) : null}
                          <span className={styles.attachmentName}>
                            {att.fileName}{error ? " (미리보기 실패)" : ""}
                          </span>
                          {onDeleteAttachment && (
                            <button
                              type="button"
                              aria-label={`${att.fileName} 삭제`}
                              onClick={async () => {
                                const accepted = await confirm({
                                  title: "계약서 사진 삭제",
                                  description: `${att.fileName} 파일을 삭제할까요?`,
                                  confirmLabel: "삭제",
                                  variant: "danger",
                                });
                                if (accepted) await onDeleteAttachment(att);
                              }}
                              disabled={isPending || isSubmitting}
                              className={styles.attachmentDelete}
                            >
                              삭제
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  <PhotoUpload
                    label="계약서 사진"
                    files={pendingPhotos}
                    onFilesChange={setPendingPhotos}
                    max={Math.max(0, 10 - attachments.length)}
                    accept="image/jpeg,image/png,image/webp"
                    disabled={isPending || isSubmitting}
                  />
                </div>

                {/* 비고 */}
                <div className={styles.fullField}>
                  <label className={styles.fieldLabel}>비고</label>
                  <textarea {...register("memo")} placeholder="비고" className={styles.fieldTextarea} />
                </div>
              </div>
            )}
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
            disabled={isPending || isSubmitting}
            className={`${styles.footerButton} ${styles.submitButton}`}
          >
            {isPending || isSubmitting ? "저장 중…" : editing ? "수정" : "추가"}
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
               closeModal(true);
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
