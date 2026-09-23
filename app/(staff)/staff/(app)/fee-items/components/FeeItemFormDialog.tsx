"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DEFAULT_FORM_VALUE, ROUNDING_OPTIONS } from "./constants";
import type { FeeItemDraft, FeeItemFormValue } from "./types";
import { CustomDropdown } from "@/components/common/CustomDropdown";
import { setSubmissionError } from "@/components/forms/formErrors";
import {
  createFeeItemSchema,
  type FeeItemFormInput,
  type FeeItemFormValues,
} from "@/components/forms/schema/feeItem";

interface FeeItemFormDialogProps {
  open: boolean;
  item: FeeItemDraft | null;
  existingNames: string[];
  onClose: () => void;
  onSubmit: (value: FeeItemFormValue) => void | Promise<void>;
  onDelete: () => void;
  isPending?: boolean;
}

const booleanOptions = [
  { value: "true", label: "적용" },
  { value: "false", label: "안함" },
];

export function FeeItemFormDialog({
  open,
  item,
  existingNames,
  onClose,
  onSubmit,
  onDelete,
  isPending = false,
}: FeeItemFormDialogProps) {
  const schema = useMemo(() => createFeeItemSchema(existingNames), [existingNames]);
  const makeDefaults = useCallback((): FeeItemFormInput => item
    ? {
        name: item.name,
        rounding: item.rounding,
        dailyProration: item.dailyProration,
        carryOver: item.carryOver,
      }
    : DEFAULT_FORM_VALUE, [item]);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FeeItemFormInput, unknown, FeeItemFormValues>({
    resolver: zodResolver(schema),
    defaultValues: makeDefaults(),
    shouldFocusError: true,
  });
  const submitting = isPending || isSubmitting;
  // 필수 항목(전기·수도료·가스)은 공과금 계산식에 물려 있어 명칭만 잠근다. 계산 설정은 수정 가능.
  const nameLocked = Boolean(item?.isRequired);
  const submittingRef = useRef(submitting);
  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);
  const closeSafely = useCallback(() => {
    if (!submittingRef.current) onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    reset(makeDefaults());
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && closeSafely();
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [closeSafely, makeDefaults, open, reset]);

  if (!open) return null;

  const submit = async (value: FeeItemFormValues) => {
    try {
      await onSubmit(value);
      reset(makeDefaults());
      onClose();
    } catch (error) {
      setSubmissionError(error, setError, "관리 항목을 반영하지 못했습니다.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim px-4" onMouseDown={closeSafely}>
      <form
        aria-label={item ? "관리 항목 수정" : "관리 항목 추가"}
        className="w-full max-w-[420px] -translate-y-[5px] overflow-hidden rounded-[20px] bg-white shadow-pop"
        onSubmit={handleSubmit(submit)}
        onMouseDown={(event) => event.stopPropagation()}
        noValidate
      >
        <header className="flex h-[68px] items-center justify-between border-b border-line px-[22px]">
          <h2 className="text-[17px] font-extrabold text-t1">관리 항목 {item ? "수정" : "추가"}</h2>
          <button type="button" aria-label="닫기" onClick={closeSafely} disabled={submitting}>
            <Image src="/icons/fee-items/close.svg" alt="" width={20} height={20} />
          </button>
        </header>

        <div className="space-y-[13px] px-[22px] pb-[37px] pt-5">
          <label htmlFor="fee-item-dialog-name" className="block text-xs font-bold text-t2">
            항목 명칭
            <input
              id="fee-item-dialog-name"
              autoFocus
              maxLength={30}
              placeholder="예: 일반관리비"
              readOnly={nameLocked}
              className={`mt-1.5 h-11 w-full rounded-[11px] border border-line px-3 text-[13px] font-semibold outline-none placeholder:text-t4 ${nameLocked ? "bg-bg text-t3" : "text-t1 focus:border-teal focus:ring-2 focus:ring-teal-t"}`}
              {...register("name")}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={nameLocked ? "fee-item-dialog-name-lock" : errors.name ? "fee-item-dialog-name-error" : undefined}
            />
            {nameLocked && (
              <span id="fee-item-dialog-name-lock" className="mt-[7px] block text-[12px] font-semibold leading-[1.5] text-t3">
                공과금 관리 계산식에 연결된 필수 항목이라 명칭 변경·삭제가 불가해요
              </span>
            )}
            {!nameLocked && errors.name?.message && <span id="fee-item-dialog-name-error" className="mt-1.5 block text-[11px] text-red">{errors.name.message}</span>}
          </label>

          <Controller control={control} name="rounding" render={({ field }) => (
            <SelectField label="반올림" value={field.value ?? "round"} options={ROUNDING_OPTIONS} onChange={field.onChange} />
          )} />
          <Controller control={control} name="dailyProration" render={({ field }) => (
            <SelectField label="일자계산" value={String(field.value)} options={booleanOptions} onChange={(value) => field.onChange(value === "true")} />
          )} />
          <Controller control={control} name="carryOver" render={({ field }) => (
            <SelectField
              label="이월"
              value={String(field.value)}
              options={[{ value: "true", label: "이월" }, { value: "false", label: "안함" }]}
              onChange={(value) => field.onChange(value === "true")}
            />
          )} />
          {errors.root?.server?.message && (
            <p role="alert" className="rounded-xl bg-red-t px-3 py-2 text-sm font-semibold text-red">{errors.root.server.message}</p>
          )}
        </div>

        <footer className="flex h-[69px] items-center gap-[9px] border-t border-line px-[22px]">
          {item ? (
            <>
              {!item.isRequired && (
                <button type="button" disabled={submitting} className="h-10 rounded-[11px] bg-red-t px-5 text-[13.5px] font-bold text-red hover:bg-[#fbdbe0] disabled:opacity-70" onClick={onDelete}>삭제</button>
              )}
              <button type="submit" disabled={submitting} className="h-10 flex-1 rounded-[11px] bg-teal text-[13.5px] font-bold text-white hover:bg-teal-d disabled:opacity-70">{submitting ? "저장 중…" : "수정"}</button>
            </>
          ) : (
            <button type="submit" disabled={submitting} className="h-10 w-full rounded-[11px] bg-teal text-[13.5px] font-bold text-white hover:bg-teal-d disabled:opacity-70">{submitting ? "저장 중…" : "추가"}</button>
          )}
        </footer>
      </form>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="text-xs font-bold text-t2">
      <span className="flex items-center gap-1.5">
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-t3 text-[9px] font-bold text-t3">i</span>
        {label}
      </span>
      <div className="mt-1.5 [&_.uc-dd]:w-full [&_.uc-dd-btn]:h-11 [&_.uc-dd-btn]:w-full [&_.uc-dd-btn]:justify-between [&_.uc-dd-btn]:text-[13px]">
        <CustomDropdown ariaLabel={label} value={value} options={options} onChange={onChange} variant="field" />
      </div>
    </div>
  );
}
