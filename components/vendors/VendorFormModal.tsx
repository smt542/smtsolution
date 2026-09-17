"use client";
import Image from "next/image";
import React, { useRef, useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Modal, PhotoUpload } from "@/components/common";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { setSubmissionError } from "@/components/forms/formErrors";
import { vendorSchema } from "@/components/forms/schema/vendor";
import type { Vendor } from "@/hooks/reactquery/vendors";
import { useAttachmentSignedUrls, type Attachment } from "@/hooks/reactquery/attachments";
import type { VendorCategory } from "@/hooks/reactquery/vendorCategories";
import { vendorClasses } from "./vendorClasses";

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
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VendorFormInput, unknown, VendorFormOutput>({
    resolver: zodResolver(vendorSchema),
    defaultValues: editing
      ? {
          name: editing.name,
          manager: editing.manager ?? "",
          phone: editing.phone ?? "",
          bankAccount: editing.bankAccount ?? "",
          memo: editing.memo ?? "",
          categoryId: editing.categoryId ?? null,
        }
      : { name: "", manager: "", phone: "", bankAccount: "", memo: "", categoryId: defaultCategoryId },
    shouldFocusError: true,
  });

  React.useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              name: editing.name,
              manager: editing.manager ?? "",
              phone: editing.phone ?? "",
              bankAccount: editing.bankAccount ?? "",
              memo: editing.memo ?? "",
              categoryId: editing.categoryId ?? null,
            }
          : { name: "", manager: "", phone: "", bankAccount: "", memo: "", categoryId: defaultCategoryId }
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
      reset({ name: "", phone: "", bankAccount: "", memo: "", categoryId: defaultCategoryId });
      closeModal(true);
    } catch (error) {
      setSubmissionError(error, setError, "업체를 저장하지 못했습니다.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => closeModal()}
      title={editing ? "업체 수정" : "업체 추가"}
      className={vendorClasses.dialog}
      overlayClassName="z-[320] p-6"
    >
      <button
        type="button"
        onClick={() => closeModal()}
        disabled={isPending || isSubmitting}
        className={vendorClasses.closeButton}
        aria-label="닫기"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      <form onSubmit={handleSubmit(onValid)}>
        {/* 구분 (category) */}
        <div className={vendorClasses.formCategory}>
          <label htmlFor={categoryControlId} className={vendorClasses.fieldLabel}>구분</label>
          <Controller
            control={control}
            name="categoryId"
            render={({ field, fieldState }) => (
              <div
                ref={categoryDropdownRef}
                className={vendorClasses.categoryDropdown}
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
                  ref={field.ref}
                  type="button"
                  role="combobox"
                  aria-label="구분"
                  aria-haspopup="listbox"
                  aria-expanded={categoryDropdownOpen}
                  aria-controls={categoryMenuId}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={fieldState.error ? `${categoryControlId}-error` : undefined}
                  className={`${vendorClasses.categoryControl} ${categoryDropdownOpen ? "border-blue" : ""}`}
                  onClick={() => setCategoryDropdownOpen((current) => !current)}
                >
                  <span className={`${vendorClasses.categoryValue} ${selectedCategory ? "" : "font-medium text-t4"}`}>{selectedCategory?.label ?? "선택"}</span>
                  <svg className={`${vendorClasses.categoryChevron} ${categoryDropdownOpen ? "rotate-180" : ""}`} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {categoryDropdownOpen ? (
                  <div id={categoryMenuId} role="listbox" aria-label="구분 선택" className={vendorClasses.categoryMenu}>
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        role="option"
                        aria-selected={field.value === category.id}
                        className={`${vendorClasses.categoryOption} ${field.value === category.id ? vendorClasses.categoryOptionSelected : ""}`}
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
          {errors.categoryId?.message && (
            <p id={`${categoryControlId}-error`} className={vendorClasses.fieldError}>{errors.categoryId.message}</p>
          )}
        </div>

        <div className={vendorClasses.formBody}>
          <div className={vendorClasses.formFields}>
            {!selectedCategory ? (
              <p className={vendorClasses.categoryHelp}>구분을 먼저 선택하세요.</p>
            ) : (
              <div className={vendorClasses.formGrid}>
                {/* 업체명 (required) */}
                <div>
                  <label htmlFor="vendor-name" className={vendorClasses.fieldLabel}>업체명</label>
                  <input
                    id="vendor-name"
                    {...register("name")}
                    placeholder="업체명"
                    className={vendorClasses.fieldInput}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? "vendor-name-error" : undefined}
                  />
                  {errors.name && (
                    <p id="vendor-name-error" className={vendorClasses.fieldError}>{errors.name.message}</p>
                  )}
                </div>

                {/* 담당자 */}
                <div>
                  <label htmlFor="vendor-manager" className={vendorClasses.fieldLabel}>담당자</label>
                  <input id="vendor-manager" {...register("manager")} placeholder="담당자" className={vendorClasses.fieldInput} aria-invalid={Boolean(errors.manager)} aria-describedby={errors.manager ? "vendor-manager-error" : undefined} />
                  {errors.manager?.message && <p id="vendor-manager-error" className={vendorClasses.fieldError}>{errors.manager.message}</p>}
                </div>

                {/* 전화 */}
                <div>
                  <label htmlFor="vendor-phone" className={vendorClasses.fieldLabel}>전화번호</label>
                  <input id="vendor-phone" {...register("phone")} placeholder="전화번호" className={`${vendorClasses.fieldInput} num`} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "vendor-phone-error" : undefined} />
                  {errors.phone?.message && <p id="vendor-phone-error" className={vendorClasses.fieldError}>{errors.phone.message}</p>}
                </div>

                {/* 계좌번호 */}
                <div>
                  <label htmlFor="vendor-bank-account" className={vendorClasses.fieldLabel}>계좌번호</label>
                  <input id="vendor-bank-account" {...register("bankAccount")} placeholder="계좌번호" className={vendorClasses.fieldInput} aria-invalid={Boolean(errors.bankAccount)} aria-describedby={errors.bankAccount ? "vendor-bank-account-error" : undefined} />
                  {errors.bankAccount?.message && <p id="vendor-bank-account-error" className={vendorClasses.fieldError}>{errors.bankAccount.message}</p>}
                </div>

                {/* 계약서 사진 */}
                <div className={vendorClasses.fullField}>
                  <label className={vendorClasses.fieldLabel}>
                    계약서 사진 <span className="font-semibold text-t4">(최대 10장)</span>
                  </label>

                  {attachments.length > 0 && (
                    <ul className={vendorClasses.attachmentList}>
                      {attachmentPreviews.map(({ attachment: att, url, error }) => (
                        <li key={att.id} className={vendorClasses.attachmentItem}>
                          {url ? (
                            <Image
                              src={url}
                              alt=""
                              width={40}
                              height={40}
                              unoptimized
                              className="size-10 rounded object-cover"
                            />
                          ) : null}
                          <span className={vendorClasses.attachmentName}>
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
                              className={vendorClasses.attachmentDelete}
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
                <div className={vendorClasses.fullField}>
                  <label htmlFor="vendor-memo" className={vendorClasses.fieldLabel}>비고</label>
                  <textarea id="vendor-memo" {...register("memo")} placeholder="비고" className={vendorClasses.fieldTextarea} aria-invalid={Boolean(errors.memo)} aria-describedby={errors.memo ? "vendor-memo-error" : undefined} />
                  {errors.memo?.message && <p id="vendor-memo-error" className={vendorClasses.fieldError}>{errors.memo.message}</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        {errors.root?.server?.message && (
          <p role="alert" className={vendorClasses.fieldError}>{errors.root.server.message}</p>
        )}

        <div className={vendorClasses.formFooter}>
          {editing && onDeleteVendor ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className={`${vendorClasses.footerButton} ${vendorClasses.deleteButton}`}
            >
              삭제
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isPending || isSubmitting}
            className={`${vendorClasses.footerButton} ${vendorClasses.submitButton}`}
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
        overlayClassName="z-[340] p-6"
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
