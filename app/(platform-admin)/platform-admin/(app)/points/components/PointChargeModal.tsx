"use client";
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal, Input, Button, Select } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import { setSubmissionError } from "@/components/forms/formErrors";
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
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Input$, unknown, Values>({
    resolver: zodResolver(pointChargeSchema),
    defaultValues: { orgId: organizations[0]?.id, points: undefined, amountKrw: undefined, memo: "" },
    shouldFocusError: true,
  });
  const submitting = isPending || isSubmitting;

  React.useEffect(() => {
    if (open) reset({ orgId: organizations[0]?.id, points: undefined, amountKrw: undefined, memo: "" });
  }, [open, organizations, reset]);

  const onValid = async (values: Values) => {
    try {
      await onSubmit(values);
      reset({ orgId: organizations[0]?.id, points: undefined, amountKrw: undefined, memo: "" });
      onClose();
    } catch (error) {
      setSubmissionError(error, setError, "포인트 충전을 기록하지 못했습니다.");
    }
  };
  const closeSafely = () => {
    if (!submitting) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={closeSafely}
      title="포인트 충전 기록"
      className={MODAL_CLASS}
    >
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4" noValidate>
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

        {errors.root?.server?.message && (
          <p role="alert" className="rounded-xl bg-red-t px-3 py-2 text-sm font-semibold text-red">
            {errors.root.server.message}
          </p>
        )}

        <ModalActions>
          <Button type="button" variant="ghost" onClick={closeSafely} disabled={submitting} className={BUTTON_CLASS}>취소</Button>
          <Button type="submit" variant="primary" disabled={submitting} className={BUTTON_CLASS}>
            {submitting ? "기록 중…" : "충전 기록"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
