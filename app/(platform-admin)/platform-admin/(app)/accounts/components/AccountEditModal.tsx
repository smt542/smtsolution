"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Modal, PhoneInput } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import { setSubmissionError } from "@/components/forms/formErrors";
import {
  platformAccountEditSchema,
  type PlatformAccountEditInput,
  type PlatformAccountEditValues,
} from "@/components/forms/schema/platformAccount";
import type { PlatformAccount } from "@/hooks/reactquery/platform";
import { useRevealPiiBatch } from "@/hooks/reactquery/pii/mutations";
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
  const piiReveal = useRevealPiiBatch(
    {
      targetKind: "profile",
      targetId: account.userId,
      fields: ["phone"],
    },
    true,
  );
  const makeDefaults = React.useCallback((): PlatformAccountEditInput => ({
    fullName: account.fullName ?? "",
    phone: "",
    memo: account.memo ?? "",
  }), [account]);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    getValues,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<PlatformAccountEditInput, unknown, PlatformAccountEditValues>({
    resolver: zodResolver(platformAccountEditSchema),
    defaultValues: makeDefaults(),
    shouldFocusError: true,
  });
  const piiRevealLoading = piiReveal.isPending || piiReveal.isFetching;
  const piiRevealReady = piiReveal.isSuccess && !piiReveal.isFetching;
  const submitting = isPending || isSubmitting || !piiRevealReady;
  const closeSafely = () => {
    if (!submitting) onClose();
  };

  React.useEffect(() => {
    reset(makeDefaults());
  }, [makeDefaults, reset]);

  // 목록(platform_list_accounts)의 번호는 마스킹되므로 폼에 쓰지 않는다. 원문은 권한검증과
  // 감사 기록을 거치는 /api/pii/reveal 로 따로 받아 채운다. 사용자가 이미 입력을 시작했으면
  // 덮어쓰지 않는다.
  React.useEffect(() => {
    if (!piiReveal.isSuccess || piiReveal.isFetching || !piiReveal.data || dirtyFields.phone) return;
    reset({ ...getValues(), phone: piiReveal.data.phone ?? "" }, { keepDirtyValues: true });
  }, [dirtyFields.phone, getValues, piiReveal.data, piiReveal.isFetching, piiReveal.isSuccess, reset]);

  const submit = async (values: PlatformAccountEditValues) => {
    // platform_update_account 는 profiles.phone 을 그대로 대입한다. 원문을 못 받은 상태로
    // 저장하면 빈 값이 원문을 덮어쓴다. 저장을 막는다.
    if (!piiReveal.isSuccess || piiReveal.isFetching || !piiReveal.data) {
      setError("root.server", {
        type: "server",
        message: "전화번호 원문을 불러오지 못해 저장할 수 없습니다.",
      });
      return;
    }

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

        {piiRevealLoading && (
          <p role="status" className="rounded-xl bg-blue-t px-3 py-2 text-sm font-semibold text-brand">
            전화번호 원문을 불러오는 중입니다. 조회가 끝날 때까지 저장할 수 없습니다.
          </p>
        )}
        {piiReveal.isError && (
          <p role="alert" className="rounded-xl bg-red-t px-3 py-2 text-sm font-semibold text-red">
            전화번호 원문을 불러오지 못했습니다. 저장할 수 없습니다.
          </p>
        )}

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
          <PhoneInput
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
          <Button
            variant="ghost"
            type="button"
            onClick={closeSafely}
            disabled={submitting}
            className="disabled:cursor-not-allowed disabled:opacity-70"
          >
            취소
          </Button>
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
