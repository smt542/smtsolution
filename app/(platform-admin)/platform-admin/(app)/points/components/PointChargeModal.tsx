"use client";
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal, Input, Button, Select } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import { pointChargeSchema } from "@/components/forms/schema/pointCharge";
import type { PlatformOrganization } from "@/hooks/reactquery/platform";
import { ModalActions } from "../../../../_components/ModalActions";

type Input$ = z.input<typeof pointChargeSchema>;
type Values = z.output<typeof pointChargeSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  organizations: PlatformOrganization[];
  onSubmit: (values: Values) => Promise<void>;
  isPending: boolean;
}

const MODAL_CLASS =
  "max-w-[420px] rounded-[20px] shadow-hf-modal [&>h2]:text-[17px] [&>h2]:tracking-[-0.02em] [&>h2]:text-t1";
const FORM_FIELD_CLASS =
  "[&>label]:mb-1.5 [&>label]:text-[12.5px] [&>label]:font-bold [&>label]:text-t2";
const INPUT_CLASS =
  "h-[42px] rounded-[10px] px-[13px] text-[13.5px] font-semibold focus:border-blue focus:ring-[3px] focus:ring-blue-t";
const BUTTON_CLASS = "h-10 rounded-[11px] px-[15px] text-[13.5px]";

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
    <Modal
      open={open}
      onClose={onClose}
      title="포인트 충전 기록"
      className={MODAL_CLASS}
    >
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        <FormField
          label="대상 조직"
          htmlFor="pc-org"
          error={errors.orgId?.message}
          className={FORM_FIELD_CLASS}
        >
          <Select
            id="pc-org"
            aria-label="대상 조직"
            {...register("orgId")}
            options={organizations.map((o) => ({ value: String(o.id), label: o.name }))}
            className={INPUT_CLASS}
          />
        </FormField>

        <FormField
          label="충전 포인트"
          htmlFor="pc-points"
          error={errors.points?.message}
          className={FORM_FIELD_CLASS}
        >
          <Input id="pc-points" aria-label="충전 포인트" type="number" inputMode="numeric" {...register("points")} placeholder="예: 10000" className={INPUT_CLASS} />
        </FormField>

        <FormField
          label="결제금액(원)"
          htmlFor="pc-amount"
          error={errors.amountKrw?.message}
          className={FORM_FIELD_CLASS}
        >
          <Input id="pc-amount" aria-label="결제금액(원)" type="number" inputMode="numeric" {...register("amountKrw")} placeholder="예: 110000" className={INPUT_CLASS} />
        </FormField>

        <FormField
          label="메모(선택)"
          htmlFor="pc-memo"
          error={errors.memo?.message}
          className={FORM_FIELD_CLASS}
        >
          <Input id="pc-memo" aria-label="메모" {...register("memo")} placeholder="예: 8월 선불 충전" className={INPUT_CLASS} />
        </FormField>

        <ModalActions>
          <Button type="button" variant="ghost" onClick={onClose} className={BUTTON_CLASS}>취소</Button>
          <Button type="submit" variant="primary" disabled={isPending} className={BUTTON_CLASS}>
            {isPending ? "기록 중…" : "충전 기록"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
