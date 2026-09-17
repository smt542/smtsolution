"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Modal } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import { setSubmissionError } from "@/components/forms/formErrors";
import {
  platformAccountEditSchema,
  type PlatformAccountEditInput,
  type PlatformAccountEditValues,
} from "@/components/forms/schema/platformAccount";
import type { PlatformAccount } from "@/hooks/reactquery/platform";
import { ModalActions } from "../../../../_components/ModalActions";
import { InlineAlert } from "../../../../_components/InlineAlert";

export type AccountEditValues = PlatformAccountEditValues;

interface Props {
  account: PlatformAccount;
  onClose: () => void;
  onSubmit: (values: AccountEditValues) => Promise<void>;
  isPending: boolean;
}

const INPUT_CLASS =
  "h-[42px] rounded-[10px] border border-line bg-surface px-[13px] text-[13.5px] font-semibold text-t1 outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-t";
const FORM_FIELD_CLASS =
  "[&>label]:mb-1.5 [&>label]:text-[12.5px] [&>label]:font-bold [&>label]:text-t2";

export function AccountEditModal({ account, onClose, onSubmit, isPending }: Props) {
  const makeDefaults = React.useCallback((): PlatformAccountEditInput => ({
    fullName: account.fullName ?? "",
    phone: account.phone ?? "",
    memo: account.memo ?? "",
  }), [account]);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PlatformAccountEditInput, unknown, PlatformAccountEditValues>({
    resolver: zodResolver(platformAccountEditSchema),
    defaultValues: makeDefaults(),
    shouldFocusError: true,
  });
  const submitting = isPending || isSubmitting;
  const closeSafely = () => {
    if (!submitting) onClose();
  };

  React.useEffect(() => {
    reset(makeDefaults());
  }, [makeDefaults, reset]);

  const submit = async (values: PlatformAccountEditValues) => {
    try {
      await onSubmit(values);
      reset(makeDefaults());
      onClose();
    } catch (error) {
      setSubmissionError(error, setError, "계정 정보 저장에 실패했습니다.");
    }
  };

  return (
    <Modal
      open
      onClose={closeSafely}
      title="계정 정보 편집"
      className="max-w-[480px] rounded-[20px] [&>h2]:text-[17px] [&>h2]:font-extrabold [&>h2]:tracking-[-0.02em]"
    >
      <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
        <p className="text-sm text-t2">
          <b>{account.username ?? account.userId}</b> · {account.organizationName}
        </p>

        <FormField label="이름" htmlFor="platform-account-edit-name" error={errors.fullName?.message} className={FORM_FIELD_CLASS}>
          <Input
            id="platform-account-edit-name"
            {...register("fullName")}
            maxLength={100}
            autoFocus
            className={INPUT_CLASS}
          />
        </FormField>

        <FormField label="전화번호" htmlFor="platform-account-edit-phone" error={errors.phone?.message} className={FORM_FIELD_CLASS}>
          <Input
            id="platform-account-edit-phone"
            {...register("phone")}
            maxLength={30}
            placeholder="010-0000-0000"
            className={INPUT_CLASS}
          />
        </FormField>

        <FormField label="메모" htmlFor="platform-account-edit-memo" error={errors.memo?.message} className={FORM_FIELD_CLASS}>
          <textarea
            id="platform-account-edit-memo"
            {...register("memo")}
            maxLength={500}
            rows={4}
            placeholder="담당 업무 · 비고"
            className="w-full resize-none rounded-[10px] border border-line bg-surface px-[13px] py-3 text-[13.5px] font-semibold text-t1 outline-none placeholder:text-t4 focus:border-blue focus:ring-[3px] focus:ring-blue-t"
          />
        </FormField>

        {errors.root?.server?.message && (
          <InlineAlert tone="dangerStrong" role="alert">
            {errors.root.server.message}
          </InlineAlert>
        )}

        <ModalActions>
          <button
            type="button"
            onClick={closeSafely}
            disabled={submitting}
            className="h-10 rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold text-t2 hover:bg-bg disabled:cursor-not-allowed disabled:opacity-70"
          >
            취소
          </button>
          <Button
            variant="primary"
            type="submit"
            disabled={submitting}
            className="submit disabled:cursor-not-allowed"
          >
            {submitting ? "저장 중…" : "저장"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
