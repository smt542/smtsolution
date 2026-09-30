"use client";

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DEFAULT_FORM_VALUE, ROUNDING_OPTIONS } from "./constants";
import type { FeeItemDraft, FeeItemFormValue } from "./types";
import { CustomDropdown } from "@/components/common/CustomDropdown";
import { IconButton } from "@/components/common/IconButton";
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

// 정본 fee-item.dc.html .mf-tip 문구. 반올림 단위는 lib/billing/proration.ts roundCharge와 같다(10원).
const ROUNDING_TIP = (
  <>
    <b>절상</b> : 무조건 10원 올림(12,342→12,350)<br />
    <b>4사5입</b> : 1~4 버림 / 5~9 올림<br />
    <b>절하</b> : 무조건 10원 내림(12,342→12,340)<br />
    <b>그대로</b> : 1원 단위 그대로
  </>
);
const DAILY_PRORATION_TIP = (
  <>
    <b>일자계산</b> : 실거주 기간만 일할 부과(중간 입주·퇴실 반영)<br />
    <b>안함</b> : 고정금액 부과
  </>
);
const CARRY_OVER_TIP = (
  <>
    <b>이월</b> : 전월 부과 금액을 다음달에 그대로 유지<br />
    <b>안함</b> : 이월 안 함(예: 수리비)
  </>
);

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
          {/* 정본 .mf-x */}
          <IconButton
            aria-label="닫기"
            className="-mr-1.5 h-8 w-8 rounded-[9px] text-t3 enabled:hover:bg-bg enabled:hover:text-t1"
            onClick={closeSafely}
            disabled={submitting}
          >
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </IconButton>
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
            <SelectField label="반올림" tip={ROUNDING_TIP} value={field.value ?? "round"} options={ROUNDING_OPTIONS} onChange={field.onChange} />
          )} />
          <Controller control={control} name="dailyProration" render={({ field }) => (
            <SelectField label="일자계산" tip={DAILY_PRORATION_TIP} value={String(field.value)} options={booleanOptions} onChange={(value) => field.onChange(value === "true")} />
          )} />
          <Controller control={control} name="carryOver" render={({ field }) => (
            <SelectField
              label="이월"
              tip={CARRY_OVER_TIP}
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
  tip,
  value,
  options,
  onChange,
}: {
  label: string;
  tip: ReactNode;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="text-xs font-bold text-t2">
      {/* 정본 .mf-info: i 아이콘·라벨에 hover하면 아이콘이 청록이 되고 설명(.mf-tip)이 내려온다 */}
      <span className="group relative flex w-fit items-center gap-[5px]">
        <span className="flex h-[15px] w-[15px] flex-none items-center justify-center rounded-full border-[1.4px] border-t4 text-[10px] font-extrabold text-t3 group-hover:border-teal group-hover:text-teal">i</span>
        {label}
        <span
          role="tooltip"
          className="invisible absolute left-[-4px] top-[calc(100%+9px)] z-[60] w-[280px] -translate-y-1 rounded-[10px] bg-[#191F28] px-[13px] py-[11px] text-[12px] font-semibold leading-[1.7] text-white opacity-0 shadow-[0_14px_32px_-10px_rgba(0,0,0,.5)] transition-all duration-150 ease-[ease] before:absolute before:bottom-full before:left-3 before:border-[6px] before:border-transparent before:border-b-[#191F28] before:content-[''] group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 [&_b]:font-extrabold"
        >
          {tip}
        </span>
      </span>
      <div className="mt-1.5 [&_.uc-dd]:w-full [&_.uc-dd-btn]:h-11 [&_.uc-dd-btn]:w-full [&_.uc-dd-btn]:justify-between [&_.uc-dd-btn]:text-[13px]">
        <CustomDropdown ariaLabel={label} value={value} options={options} onChange={onChange} variant="field" />
      </div>
    </div>
  );
}
