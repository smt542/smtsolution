"use client";

import React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, CustomDropdown, Input, Modal } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import { setSubmissionError } from "@/components/forms/formErrors";
import {
  pointAdjustmentSchema,
  type PointAdjustmentFormValues,
} from "@/components/forms/schema/pointAdjustment";
import type { PlatformOrganization } from "@/hooks/reactquery/platform";
import { ModalActions } from "../../../../_components/ModalActions";
import { InlineAlert } from "../../../../_components/InlineAlert";
import {
  ADMIN_DROPDOWN_MENU_CLASS,
  ADMIN_FORM_DROPDOWN_CLASS,
} from "../../../../_components/adminDropdownClasses";

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
  "max-w-[440px] rounded-[20px] shadow-hf-modal [&>h2]:text-[17px] [&>h2]:tracking-[-0.02em] [&>h2]:text-t1";
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
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, PointAdjustmentFormValues>({
    resolver: zodResolver(pointAdjustmentSchema),
    defaultValues: {
      orgId: organizations[0]?.id,
      kind: "correction",
      points: undefined,
      amountKrw: undefined,
      memo: "",
    },
    shouldFocusError: true,
  });
  const submitting = isPending || isSubmitting;
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
    try {
      await onSubmit(values);
      reset({
        orgId: organizations[0]?.id,
        kind: "correction",
        points: undefined,
        amountKrw: undefined,
        memo: "",
      });
      onClose();
    } catch (error) {
      setSubmissionError(error, setError, "포인트 조정을 기록하지 못했습니다.");
    }
  };
  const closeSafely = () => {
    if (!submitting) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={closeSafely}
      title="포인트 조정"
      className={MODAL_CLASS}
    >
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4" noValidate>
        <FormField
          label="대상 조직"
          htmlFor="pa-org"
          error={errors.orgId?.message}
          className={FORM_FIELD_CLASS}
        >
          <div className={ADMIN_FORM_DROPDOWN_CLASS}>
            <Controller
              control={control}
              name="orgId"
              render={({ field }) => (
                <CustomDropdown
                  id="pa-org"
                  ariaLabel="대상 조직"
                  value={field.value == null ? "" : String(field.value)}
                  options={organizations.map((organization) => ({
                    value: String(organization.id),
                    label: organization.name,
                  }))}
                  position="fixed"
                  menuMinWidth={0}
                  menuClassName={ADMIN_DROPDOWN_MENU_CLASS}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
        </FormField>

        <FormField
          label="조정 구분"
          htmlFor="pa-kind"
          error={errors.kind?.message}
          className={FORM_FIELD_CLASS}
        >
          <div className={ADMIN_FORM_DROPDOWN_CLASS}>
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <CustomDropdown
                  id="pa-kind"
                  ariaLabel="조정 구분"
                  value={String(field.value ?? "")}
                  options={KIND_OPTIONS}
                  position="fixed"
                  menuMinWidth={0}
                  menuClassName={ADMIN_DROPDOWN_MENU_CLASS}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
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

        {errors.root?.server?.message && (
          <InlineAlert tone="dangerStrong" role="alert">{errors.root.server.message}</InlineAlert>
        )}

        <ModalActions>
          <Button type="button" variant="ghost" onClick={closeSafely} disabled={submitting} className={BUTTON_CLASS}>
            취소
          </Button>
          <Button type="submit" variant="primary" disabled={submitting || organizations.length === 0} className={BUTTON_CLASS}>
            {submitting ? "기록 중…" : "조정 기록"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
