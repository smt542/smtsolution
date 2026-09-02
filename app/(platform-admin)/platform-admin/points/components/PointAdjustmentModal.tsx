"use client";

import React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Input, Modal, Select } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import {
  pointAdjustmentSchema,
  type PointAdjustmentFormValues,
} from "@/components/forms/schema/pointAdjustment";
import type { PlatformOrganization } from "@/hooks/reactquery/platform";

type FormInput = z.input<typeof pointAdjustmentSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  organizations: PlatformOrganization[];
  onSubmit: (values: PointAdjustmentFormValues) => Promise<void>;
  isPending: boolean;
}

const KIND_OPTIONS = [
  { value: "correction", label: "정정" },
  { value: "deduction", label: "차감" },
  { value: "refund", label: "환불" },
];

export function PointAdjustmentModal({
  open,
  onClose,
  organizations,
  onSubmit,
  isPending,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormInput, unknown, PointAdjustmentFormValues>({
    resolver: zodResolver(pointAdjustmentSchema),
    defaultValues: {
      orgId: organizations[0]?.id,
      kind: "correction",
      points: undefined,
      amountKrw: undefined,
      memo: "",
    },
  });
  const kind = useWatch({ control, name: "kind" });

  React.useEffect(() => {
    if (!open) return;
    reset({
      orgId: organizations[0]?.id,
      kind: "correction",
      points: undefined,
      amountKrw: undefined,
      memo: "",
    });
  }, [open, organizations, reset]);

  const onValid = async (values: PointAdjustmentFormValues) => {
    await onSubmit(values);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="포인트 조정">
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        <FormField label="대상 조직" htmlFor="pa-org" error={errors.orgId?.message}>
          <select
            id="pa-org"
            aria-label="대상 조직"
            {...register("orgId")}
            className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-t1 focus:border-brand focus:outline-none"
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="조정 구분" htmlFor="pa-kind" error={errors.kind?.message}>
          <Select id="pa-kind" aria-label="조정 구분" {...register("kind")} options={KIND_OPTIONS} />
        </FormField>

        <FormField
          label="조정 포인트"
          htmlFor="pa-points"
          error={errors.points?.message}
          hint={kind === "correction" ? "정정은 증가(+)와 감소(-) 모두 가능합니다." : "차감·환불은 음수로 입력해 주세요."}
        >
          <Input
            id="pa-points"
            aria-label="조정 포인트"
            type="number"
            inputMode="numeric"
            {...register("points")}
            placeholder={kind === "correction" ? "예: 1000 또는 -1000" : "예: -1000"}
          />
        </FormField>

        {kind === "refund" && (
          <FormField label="실제 환불액(원, 선택)" htmlFor="pa-amount" error={errors.amountKrw?.message}>
            <Input
              id="pa-amount"
              aria-label="실제 환불액(원)"
              type="number"
              inputMode="numeric"
              min={0}
              {...register("amountKrw")}
              placeholder="예: 11000"
            />
          </FormField>
        )}

        <FormField label="조정 사유" htmlFor="pa-memo" error={errors.memo?.message}>
          <Input
            id="pa-memo"
            aria-label="조정 사유"
            {...register("memo")}
            placeholder="예: 중복 충전분 환불"
          />
        </FormField>

        <p className="rounded-xl bg-amber-t px-3 py-2 text-xs font-semibold text-amber">
          조정 내역은 포인트 원장에 남으며 삭제할 수 없습니다.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" variant="primary" disabled={isPending || organizations.length === 0}>
            {isPending ? "기록 중…" : "조정 기록"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
