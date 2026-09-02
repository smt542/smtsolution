"use client";
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal, Input, Button } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import { pointChargeSchema } from "@/components/forms/schema/pointCharge";
import type { PlatformOrganization } from "@/hooks/reactquery/platform";

type Input$ = z.input<typeof pointChargeSchema>;
type Values = z.output<typeof pointChargeSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  organizations: PlatformOrganization[];
  onSubmit: (values: Values) => Promise<void>;
  isPending: boolean;
}

export function PointChargeModal({ open, onClose, organizations, onSubmit, isPending }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Input$, unknown, Values>({
    resolver: zodResolver(pointChargeSchema),
    defaultValues: { orgId: organizations[0]?.id, points: undefined, amountKrw: undefined, memo: "" },
  });

  React.useEffect(() => {
    if (open) reset({ orgId: organizations[0]?.id, points: undefined, amountKrw: undefined, memo: "" });
  }, [open, organizations, reset]);

  const onValid = async (values: Values) => {
    await onSubmit(values);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="포인트 충전 기록">
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        <FormField label="대상 조직" htmlFor="pc-org" error={errors.orgId?.message}>
          <select
            id="pc-org"
            aria-label="대상 조직"
            {...register("orgId")}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </FormField>

        <FormField label="충전 포인트" htmlFor="pc-points" error={errors.points?.message}>
          <Input id="pc-points" aria-label="충전 포인트" type="number" inputMode="numeric" {...register("points")} placeholder="예: 10000" />
        </FormField>

        <FormField label="결제금액(원)" htmlFor="pc-amount" error={errors.amountKrw?.message}>
          <Input id="pc-amount" aria-label="결제금액(원)" type="number" inputMode="numeric" {...register("amountKrw")} placeholder="예: 110000" />
        </FormField>

        <FormField label="메모(선택)" htmlFor="pc-memo" error={errors.memo?.message}>
          <Input id="pc-memo" aria-label="메모" {...register("memo")} placeholder="예: 8월 선불 충전" />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>취소</Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "기록 중…" : "충전 기록"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
