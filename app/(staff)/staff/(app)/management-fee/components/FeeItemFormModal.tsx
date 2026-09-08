"use client";
import React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal, Input, Select, Button } from "@/components/common";
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
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FeeItemInput, unknown, FormValues>({
    resolver: zodResolver(feeItemSchema),
    defaultValues: editing
      ? {
          name: editing.name,
          rounding: editing.rounding as FeeItemInput["rounding"],
          dailyProration: editing.dailyProration,
          carryOver: editing.carryOver,
        }
      : { rounding: "round", dailyProration: false, carryOver: false },
  });

  React.useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              name: editing.name,
              rounding: editing.rounding as FeeItemInput["rounding"],
              dailyProration: editing.dailyProration,
              carryOver: editing.carryOver,
            }
          : { rounding: "round", dailyProration: false, carryOver: false }
      );
    }
  }, [open, editing, reset]);

  const onValid = async (values: FormValues) => {
    await onSubmit(values);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "항목 수정" : "항목 추가"}>
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-t3">항목명칭</label>
          <Input
            {...register("name")}
            placeholder="예: 관리비"
            className={errors.name ? "border-danger" : ""}
          />
          {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-t3">반올림</label>
          <Controller
            control={control}
            name="rounding"
            render={({ field }) => (
              <Select options={ROUNDING_OPTIONS} {...field} />
            )}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-t3">일자계산</label>
          <Controller
            control={control}
            name="dailyProration"
            render={({ field }) => (
              <Select
                options={DAILY_OPTIONS}
                value={field.value ? "true" : "false"}
                onChange={(e) => field.onChange(e.target.value === "true")}
              />
            )}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-t3">이월</label>
          <Controller
            control={control}
            name="carryOver"
            render={({ field }) => (
              <Select
                options={CARRY_OPTIONS}
                value={field.value ? "true" : "false"}
                onChange={(e) => field.onChange(e.target.value === "true")}
              />
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "저장 중…" : editing ? "수정" : "추가"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
