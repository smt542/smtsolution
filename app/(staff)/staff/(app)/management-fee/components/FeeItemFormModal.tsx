"use client";
import React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal, Input, Select, Button } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import { setSubmissionError } from "@/components/forms/formErrors";
import { feeItemSchema } from "@/components/forms/schema/feeItem";
import type { FeeItem } from "@/hooks/reactquery/feeItems";

// Input type (before Zod coercion) for useForm; resolver produces Output
type FeeItemInput = z.input<typeof feeItemSchema>;
// Output type (after Zod parse) for the submit callback
type FormValues = z.output<typeof feeItemSchema>;

const ROUNDING_OPTIONS = [
  { value: "up", label: "절상" },
  { value: "round", label: "4사5입" },
  { value: "down", label: "절하" },
  { value: "raw", label: "그대로" },
];

const DAILY_OPTIONS = [
  { value: "true", label: "적용" },
  { value: "false", label: "안함" },
];

const CARRY_OPTIONS = [
  { value: "true", label: "이월" },
  { value: "false", label: "안함" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  editing: FeeItem | null;
  onSubmit: (values: FormValues) => Promise<void>;
  isPending: boolean;
}

export function FeeItemFormModal({ open, onClose, editing, onSubmit, isPending }: Props) {
  const makeDefaults = React.useCallback((): FeeItemInput => editing
    ? {
        name: editing.name,
        rounding: editing.rounding as FeeItemInput["rounding"],
        dailyProration: editing.dailyProration,
        carryOver: editing.carryOver,
      }
    : { name: "", rounding: "round", dailyProration: false, carryOver: false }, [editing]);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FeeItemInput, unknown, FormValues>({
    resolver: zodResolver(feeItemSchema),
    defaultValues: makeDefaults(),
    shouldFocusError: true,
  });
  const submitting = isPending || isSubmitting;
  const closeSafely = () => {
    if (!submitting) onClose();
  };

  React.useEffect(() => {
    if (open) {
      reset(makeDefaults());
    }
  }, [makeDefaults, open, reset]);

  const onValid = async (values: FormValues) => {
    try {
      await onSubmit(values);
      reset(makeDefaults());
      onClose();
    } catch (error) {
      setSubmissionError(error, setError, "관리비 항목을 저장하지 못했습니다.");
    }
  };

  return (
    <Modal open={open} onClose={closeSafely} title={editing ? "항목 수정" : "항목 추가"}>
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4" noValidate>
        <FormField htmlFor="management-fee-item-name" label="항목명칭" error={errors.name?.message}>
          <Input
            id="management-fee-item-name"
            {...register("name")}
            placeholder="예: 관리비"
            className={errors.name ? "border-danger" : ""}
          />
        </FormField>

        <FormField htmlFor="management-fee-item-rounding" label="반올림" error={errors.rounding?.message}>
          <Controller
            control={control}
            name="rounding"
            render={({ field }) => (
              <Select id="management-fee-item-rounding" options={ROUNDING_OPTIONS} {...field} />
            )}
          />
        </FormField>

        <FormField htmlFor="management-fee-item-daily" label="일자계산" error={errors.dailyProration?.message}>
          <Controller
            control={control}
            name="dailyProration"
            render={({ field }) => (
              <Select
                id="management-fee-item-daily"
                options={DAILY_OPTIONS}
                value={field.value ? "true" : "false"}
                onChange={(e) => field.onChange(e.target.value === "true")}
              />
            )}
          />
        </FormField>

        <FormField htmlFor="management-fee-item-carry" label="이월" error={errors.carryOver?.message}>
          <Controller
            control={control}
            name="carryOver"
            render={({ field }) => (
              <Select
                id="management-fee-item-carry"
                options={CARRY_OPTIONS}
                value={field.value ? "true" : "false"}
                onChange={(e) => field.onChange(e.target.value === "true")}
              />
            )}
          />
        </FormField>

        {errors.root?.server?.message && (
          <p role="alert" className="rounded-xl bg-red-t px-3 py-2 text-sm font-semibold text-red">{errors.root.server.message}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={closeSafely} disabled={submitting}>
            취소
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "저장 중…" : editing ? "수정" : "추가"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
