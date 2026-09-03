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
import { ModalActions } from "../../../_components/ModalActions";
import { InlineAlert } from "../../../_components/InlineAlert";

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

const MODAL_CLASS =
  "max-w-[440px] rounded-[20px] shadow-pop [&>h2]:text-[17px] [&>h2]:tracking-[-0.02em] [&>h2]:text-t1";
const FORM_FIELD_CLASS =
  "[&>label]:mb-1.5 [&>label]:text-[12.5px] [&>label]:font-bold [&>label]:text-t2";
const INPUT_CLASS =
  "h-[42px] rounded-[10px] px-[13px] text-[13.5px] font-semibold focus:border-blue focus:ring-[3px] focus:ring-blue-t";
const BUTTON_CLASS = "h-10 rounded-[11px] px-[15px] text-[13.5px]";

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
    <Modal
      open={open}
      onClose={onClose}
      title="포인트 조정"
      className={MODAL_CLASS}
    >
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        <FormField
          label="대상 조직"
          htmlFor="pa-org"
          error={errors.orgId?.message}
          className={FORM_FIELD_CLASS}
        >
          <select
            id="pa-org"
            aria-label="대상 조직"
            {...register("orgId")}
            className="h-[42px] w-full rounded-[10px] border border-line bg-surface px-[13px] text-[13.5px] font-semibold text-t1 outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-t"
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="조정 구분"
          htmlFor="pa-kind"
          error={errors.kind?.message}
          className={FORM_FIELD_CLASS}
        >
          <Select id="pa-kind" aria-label="조정 구분" {...register("kind")} options={KIND_OPTIONS} className={INPUT_CLASS} />
        </FormField>

        <FormField
          label="조정 포인트"
          htmlFor="pa-points"
          error={errors.points?.message}
          hint={kind === "correction" ? "정정은 증가(+)와 감소(-) 모두 가능합니다." : "차감·환불은 음수로 입력해 주세요."}
          className={FORM_FIELD_CLASS}
        >
          <Input
            id="pa-points"
            aria-label="조정 포인트"
            type="number"
            inputMode="numeric"
            {...register("points")}
            placeholder={kind === "correction" ? "예: 1000 또는 -1000" : "예: -1000"}
            className={INPUT_CLASS}
          />
        </FormField>

        {kind === "refund" && (
          <FormField
            label="실제 환불액(원, 선택)"
            htmlFor="pa-amount"
            error={errors.amountKrw?.message}
            className={FORM_FIELD_CLASS}
          >
            <Input
              id="pa-amount"
              aria-label="실제 환불액(원)"
              type="number"
              inputMode="numeric"
              min={0}
              {...register("amountKrw")}
              placeholder="예: 11000"
              className={INPUT_CLASS}
            />
          </FormField>
        )}

        <FormField
          label="조정 사유"
          htmlFor="pa-memo"
          error={errors.memo?.message}
          className={FORM_FIELD_CLASS}
        >
          <Input
            id="pa-memo"
            aria-label="조정 사유"
            {...register("memo")}
            placeholder="예: 중복 충전분 환불"
            className={INPUT_CLASS}
          />
        </FormField>

        <InlineAlert tone="warning">
          조정 내역은 포인트 원장에 남으며 삭제할 수 없습니다.
        </InlineAlert>

        <ModalActions>
          <Button type="button" variant="ghost" onClick={onClose} className={BUTTON_CLASS}>
            취소
          </Button>
          <Button type="submit" variant="primary" disabled={isPending || organizations.length === 0} className={BUTTON_CLASS}>
            {isPending ? "기록 중…" : "조정 기록"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
