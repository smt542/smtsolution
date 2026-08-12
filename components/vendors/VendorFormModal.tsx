"use client";
import React, { useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal, Input, Select, Button } from "@/components/common";
import { vendorSchema } from "@/components/forms/schema/vendor";
import type { Vendor } from "@/hooks/reactquery/vendors";
import type { VendorAttachment } from "@/hooks/reactquery/vendors";
import type { VendorCategory } from "@/hooks/reactquery/vendorCategories";

// Use z.input so form fields stay as strings/null before Zod coercion
type VendorFormInput = z.input<typeof vendorSchema>;
type VendorFormOutput = z.output<typeof vendorSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editing: Vendor | null;
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
      : { name: "", phone: "", bankAccount: "", memo: "", categoryId: null },
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
          : { name: "", phone: "", bankAccount: "", memo: "", categoryId: null }
      );
    }
  }, [open, editing, reset]);

  const onValid = async (values: VendorFormOutput) => {
    await onSubmit(values);
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadAttachment) return;
    await onUploadAttachment(file);
    // Reset file input so the same file can be re-uploaded if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "업체 수정" : "업체 추가"}>
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {/* 구분 (category) */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-t3">구분</label>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <Select
                options={categoryOptions}
                value={field.value != null ? String(field.value) : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  field.onChange(v === "" ? null : Number(v));
                }}
              />
            )}
          />
        </div>

        {/* 업체명 (required) */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-t3">업체명</label>
          <Input
            {...register("name")}
            placeholder="예: 한국전력"
            className={errors.name ? "border-danger" : ""}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
          )}
        </div>

        {/* 전화 */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-t3">전화</label>
          <Input {...register("phone")} placeholder="예: 02-1234-5678" />
        </div>

        {/* 계좌번호 */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-t3">계좌번호</label>
          <Input {...register("bankAccount")} placeholder="예: 국민 1234-56-7890" />
        </div>

        {/* 비고 */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-t3">비고</label>
          <Input {...register("memo")} placeholder="메모" />
        </div>

        {/* 계약서 사진 — only in edit mode (vendorId required) */}
        {editing && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <p className="text-xs font-semibold text-t3">계약서 사진</p>

            {attachments.length > 0 && (
              <ul className="flex flex-col gap-1">
                {attachments.map((att) => (
                  <li
                    key={att.id}
                    className="flex items-center justify-between rounded-lg bg-bg px-3 py-2 text-sm"
                  >
                    <span className="truncate text-t1">{att.fileName}</span>
                    {onDeleteAttachment && (
                      <button
                        type="button"
                        aria-label={`${att.fileName} 삭제`}
                        onClick={() => onDeleteAttachment(att)}
                        className="ml-2 text-xs text-danger hover:underline"
                      >
                        삭제
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-t3 hover:border-brand">
              <span>+ 파일 추가</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
                aria-label="계약서 사진 업로드"
              />
            </label>
            <p className="text-xs text-t4">새 업체는 저장 후 사진을 첨부할 수 있습니다.</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          {editing && onDeleteVendor ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              className="text-danger"
            >
              삭제
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "저장 중…" : editing ? "수정" : "추가"}
            </Button>
          </div>
        </div>
      </form>

      {/* Delete confirm modal */}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="거래처 삭제"
      >
        <p className="text-sm text-t2">이 거래처를 삭제할까요?</p>
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
