"use client";
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal, Button, Input, Select } from "@/components/common";
import { occupancySchema } from "@/components/forms/schema/occupancy";
import { z } from "zod";

// Use z.input so RHF sees status as optional (before .default() coercion)
type OccupancyFormInput = z.input<typeof occupancySchema>;
// Output type (after Zod parse) has status required — used in submit handler
type OccupancyFormOutput = z.output<typeof occupancySchema>;
import { useCreateOccupancy, useUpdateOccupancy } from "@/hooks/reactquery/occupancies";
import type { Occupancy } from "@/hooks/reactquery/occupancies";

interface Props {
  open: boolean;
  onClose: () => void;
  unitId: number;
  editing?: Occupancy | null;
}

const STATUS_OPTIONS = [
  { value: "occupied", label: "입주중" },
  { value: "vacant", label: "공실" },
  { value: "moving_out", label: "퇴거예정" },
];

export function OccupancyFormModal({ open, onClose, unitId, editing }: Props) {
  const createOccupancy = useCreateOccupancy();
  const updateOccupancy = useUpdateOccupancy();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<OccupancyFormInput, unknown, OccupancyFormOutput>({
    resolver: zodResolver(occupancySchema),
    defaultValues: editing
      ? {
          tenantName: editing.tenantName ?? "",
          payerName: editing.payerName ?? "",
          phone: editing.phone ?? "",
          residentCount: editing.residentCount ?? undefined,
          vehicleNo: editing.vehicleNo ?? "",
          moveInDate: editing.moveInDate ?? "",
          moveOutDate: editing.moveOutDate ?? "",
          deposit: editing.deposit ?? undefined,
          monthlyRent: editing.monthlyRent ?? undefined,
          status: editing.status,
          memo: editing.memo ?? "",
        }
      : { status: "occupied" },
  });

  React.useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              tenantName: editing.tenantName ?? "",
              payerName: editing.payerName ?? "",
              phone: editing.phone ?? "",
              residentCount: editing.residentCount ?? undefined,
              vehicleNo: editing.vehicleNo ?? "",
              moveInDate: editing.moveInDate ?? "",
              moveOutDate: editing.moveOutDate ?? "",
              deposit: editing.deposit ?? undefined,
              monthlyRent: editing.monthlyRent ?? undefined,
              status: editing.status,
              memo: editing.memo ?? "",
            }
          : { status: "occupied" }
      );
    }
  }, [open, editing, reset]);

  const onSubmit = async (values: OccupancyFormOutput) => {
    try {
      const mapped = {
        tenantName: values.tenantName,
        payerName: values.payerName,
        phone: values.phone,
        residentCount: values.residentCount,
        vehicleNo: values.vehicleNo,
        moveInDate: values.moveInDate,
        moveOutDate: values.moveOutDate,
        deposit: values.deposit,
        monthlyRent: values.monthlyRent,
        status: values.status,
        memo: values.memo,
      };
      if (editing) {
        await updateOccupancy.mutateAsync({ id: editing.id, input: mapped });
      } else {
        await createOccupancy.mutateAsync({ unitId, ...mapped });
      }
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "저장 실패");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "입주 정보 수정" : "입주 정보 등록"}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">입주자명</label>
          <Input {...register("tenantName")} placeholder="입주자 이름" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">납부자명</label>
          <Input {...register("payerName")} placeholder="납부자 이름" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">연락처</label>
          <Input {...register("phone")} placeholder="010-0000-0000" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">인원</label>
          <Input
            type="number"
            {...register("residentCount", { valueAsNumber: true })}
            placeholder="예: 2"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">차량번호</label>
          <Input {...register("vehicleNo")} placeholder="예: 12가3456" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">입주 상태</label>
          <Select options={STATUS_OPTIONS} {...register("status")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">입주일</label>
          <Input type="date" {...register("moveInDate")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">퇴거일</label>
          <Input type="date" {...register("moveOutDate")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">보증금</label>
          <Input
            type="number"
            {...register("deposit", { valueAsNumber: true })}
            placeholder="예: 5000000"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">월세</label>
          <Input
            type="number"
            {...register("monthlyRent", { valueAsNumber: true })}
            placeholder="예: 300000"
          />
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
