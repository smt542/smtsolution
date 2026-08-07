"use client";
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "@/components/common";
import { Button, Input, Select } from "@/components/common";
import { buildingSchema, BuildingFormValues } from "@/components/forms/schema/building";
import { useCreateBuilding, useUpdateBuilding } from "@/hooks/reactquery/buildings";
import { useBuildingTypes } from "@/hooks/reactquery/buildingTypes";
import { useMe } from "@/hooks/reactquery/auth";
import type { Building } from "@/hooks/reactquery/buildings";

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Building | null;
}

export function BuildingFormModal({ open, onClose, editing }: Props) {
  const { data: me } = useMe();
  const { data: buildingTypes = [] } = useBuildingTypes();
  const createBuilding = useCreateBuilding();
  const updateBuilding = useUpdateBuilding();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BuildingFormValues>({
    resolver: zodResolver(buildingSchema),
    defaultValues: editing
      ? {
          code: editing.code,
          name: editing.name,
          address: editing.address ?? "",
          typeId: editing.typeId ?? undefined,
          ownerName: editing.ownerName ?? "",
          ownerPhone: editing.ownerPhone ?? "",
          entrancePassword: editing.entrancePassword ?? "",
          managerName: editing.managerName ?? "",
          meterStaffName: editing.meterStaffName ?? "",
          cleaningStaffName: editing.cleaningStaffName ?? "",
          memo: editing.memo ?? "",
        }
      : {},
  });

  React.useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              code: editing.code,
              name: editing.name,
              address: editing.address ?? "",
              typeId: editing.typeId ?? undefined,
              ownerName: editing.ownerName ?? "",
              ownerPhone: editing.ownerPhone ?? "",
              entrancePassword: editing.entrancePassword ?? "",
              managerName: editing.managerName ?? "",
              meterStaffName: editing.meterStaffName ?? "",
              cleaningStaffName: editing.cleaningStaffName ?? "",
              memo: editing.memo ?? "",
            }
          : {}
      );
    }
  }, [open, editing, reset]);

  const typeOptions = [
    { value: "", label: "유형 선택" },
    ...buildingTypes.map((t) => ({ value: String(t.id), label: t.label })),
  ];

  const onSubmit = async (values: BuildingFormValues) => {
    try {
      const orgId = me?.orgId ?? 0;
      const payload = {
        orgId,
        code: values.code,
        name: values.name,
        address: values.address,
        typeId: values.typeId ?? null,
        ownerName: values.ownerName,
        ownerPhone: values.ownerPhone,
        entrancePassword: values.entrancePassword,
        managerName: values.managerName,
        meterStaffName: values.meterStaffName,
        cleaningStaffName: values.cleaningStaffName,
        memo: values.memo,
      };
      if (editing) {
        await updateBuilding.mutateAsync({ id: editing.id, input: payload });
      } else {
        await createBuilding.mutateAsync(payload);
      }
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "저장 실패");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "건물 수정" : "건물 등록"}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">코드 *</label>
          <Input {...register("code")} placeholder="건물 코드" />
          {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">건물명 *</label>
          <Input {...register("name")} placeholder="건물명" />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">주소</label>
          <Input {...register("address")} placeholder="주소" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">유형</label>
          <Select
            options={typeOptions}
            {...register("typeId", {
              setValueAs: (v) => (v === "" ? undefined : Number(v)),
            })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">건물주명</label>
          <Input {...register("ownerName")} placeholder="건물주 이름" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-t2">건물주 연락처</label>
          <Input {...register("ownerPhone")} placeholder="010-0000-0000" />
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
