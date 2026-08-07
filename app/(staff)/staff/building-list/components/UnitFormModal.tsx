"use client";
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal, Button, Input } from "@/components/common";
import { unitSchema, UnitFormValues } from "@/components/forms/schema/unit";
import { useCreateUnit, useUpdateUnit } from "@/hooks/reactquery/units";
import type { Unit } from "@/hooks/reactquery/units";

interface Props {
  open: boolean;
  onClose: () => void;
  buildingId: number;
  editing?: Unit | null;
}

export function UnitFormModal({ open, onClose, buildingId, editing }: Props) {
  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: editing
      ? {
          unitNo: editing.unitNo,
          dong: editing.dong ?? "",
          memo: editing.memo ?? "",
        }
      : {},
  });

  React.useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              unitNo: editing.unitNo,
              dong: editing.dong ?? "",
              memo: editing.memo ?? "",
            }
          : {}
      );
    }
  }, [open, editing, reset]);

  const onSubmit = async (values: UnitFormValues) => {
    try {
      // areaPyeong in schema is number but UnitInput expects string
      const mapped = {
        unitNo: values.unitNo,
        dong: values.dong,
        areaPyeong: values.areaPyeong != null ? String(values.areaPyeong) : undefined,
        roomCount: values.roomCount,
        elecCustomerNo: values.elecCustomerNo,
        elecMeterNo: values.elecMeterNo,
        waterCustomerNo: values.waterCustomerNo,
        memo: values.memo,
      };
      if (editing) {
        await updateUnit.mutateAsync({ id: editing.id, input: mapped });
      } else {
        await createUnit.mutateAsync({ buildingId, ...mapped });
      }
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "저장 실패");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "호실 수정" : "호실 등록"}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">호실 번호 *</label>
          <Input {...register("unitNo")} placeholder="예: 101호" />
          {errors.unitNo && <p className="mt-1 text-xs text-red-500">{errors.unitNo.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">동</label>
          <Input {...register("dong")} placeholder="예: A동" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">메모</label>
          <Input {...register("memo")} placeholder="메모" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "저장 중…" : "저장"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
