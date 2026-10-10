"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import { setSubmissionError } from "@/components/forms/formErrors";
import {
  passwordChangeSchema,
  type PasswordChangeInput,
  type PasswordChangeValues,
} from "@/components/forms/schema/password";
import { useChangeMyPassword } from "@/hooks/reactquery/auth";
import { PASSWORD_MAX_LENGTH, PASSWORD_RULE_TEXT } from "@/lib/auth/passwordPolicy";

const FIELD_CLASS = {
  // 로그인 화면 입력칸(.h-12)과 같은 규격
  page: "h-12 rounded-[13px] border border-line bg-white text-[14.5px] font-medium text-t1 placeholder:text-[#757575] outline-none transition focus:border-[#14A497] focus:ring-[3px] focus:ring-blue-t",
  // 모달 폼 입력칸(42px)
  modal: "h-[42px] rounded-[10px] border border-line bg-white text-[13.5px] font-semibold text-t1 placeholder:font-medium placeholder:text-t4 outline-none transition focus:border-[#14A497] focus:ring-[3px] focus:ring-blue-t",
} as const;

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2.8 2.8 0 0 0 3.8 3.8" />
      <path d="M9.4 5.2A9.3 9.3 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4" />
      <path d="M6.2 6.2A17 17 0 0 0 2 12s3.6 7 10 7a9.3 9.3 0 0 0 3-.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

/**
 * 새 비밀번호 + 새 비밀번호 확인 폼(최초 로그인 강제 변경·내 정보 변경 공용).
 * 현재 비밀번호는 화면에 보여주지 않는다 — 원문을 저장하지 않으므로 보여줄 수도 없다.
 */
export function PasswordChangeForm({
  variant = "page",
  submitLabel = "비밀번호 변경",
  onSuccess,
  secondaryAction,
}: {
  variant?: keyof typeof FIELD_CLASS;
  submitLabel?: string;
  onSuccess: () => void;
  /** 제출 버튼 왼쪽(모달의 취소 등) */
  secondaryAction?: ReactNode;
}) {
  const change = useChangeMyPassword();
  const [show, setShow] = useState(false);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<
    PasswordChangeInput,
    unknown,
    PasswordChangeValues
  >({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
    shouldFocusError: true,
  });
  const submitting = change.isPending || isSubmitting;
  const field = FIELD_CLASS[variant];

  const onSubmit = handleSubmit(async (values) => {
    try {
      await change.mutateAsync(values.newPassword);
      onSuccess();
    } catch (error) {
      setSubmissionError(error, setError, "잠시 후 다시 시도해 주세요.");
    }
  });

  const passwordInput = (name: "newPassword" | "confirmPassword", placeholder: string, withToggle: boolean) => (
    <div className="relative flex items-center">
      <Input
        unstyled
        id={name}
        type={show ? "text" : "password"}
        autoComplete="new-password"
        maxLength={PASSWORD_MAX_LENGTH}
        placeholder={placeholder}
        className={`${field} w-full pl-3.5 ${withToggle ? "pr-12" : "pr-3.5"}`}
        aria-invalid={Boolean(errors[name])}
        {...register(name)}
      />
      {withToggle && (
        <button
          type="button"
          aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"}
          onClick={() => setShow((value) => !value)}
          className={`absolute right-2 flex h-8 w-8 items-center justify-center rounded-[9px] ${show ? "text-blue" : "text-t4"}`}
        >
          <EyeIcon open={show} />
        </button>
      )}
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
      <FormField htmlFor="newPassword" label="새 비밀번호" error={errors.newPassword?.message} className="flex flex-col gap-[7px]">
        {passwordInput("newPassword", `${PASSWORD_RULE_TEXT} 입력해 주세요`, true)}
      </FormField>
      <FormField htmlFor="confirmPassword" label="새 비밀번호 확인" error={errors.confirmPassword?.message} className="flex flex-col gap-[7px]">
        {passwordInput("confirmPassword", "새 비밀번호를 한 번 더 입력해 주세요", false)}
      </FormField>
      <p className="text-[12.5px] font-medium leading-[1.6] text-t3">
        영문·숫자·특수문자 등 자유롭게 {PASSWORD_RULE_TEXT}로 정해 주세요.
      </p>
      {errors.root?.server?.message && (
        <div role="alert" className="rounded-[11px] bg-red-t px-3 py-2.5 text-sm font-bold text-red">{errors.root.server.message}</div>
      )}
      <div className={variant === "modal" ? "mt-1 flex items-center gap-2" : "mt-1.5 flex flex-col gap-2"}>
        {variant === "modal" && <div className="flex-1" />}
        {secondaryAction}
        <Button
          variant="primary"
          size={variant === "modal" ? "std" : "login"}
          type="submit"
          disabled={submitting}
          className="border border-transparent shadow-none transition disabled:opacity-70"
        >
          {submitting ? "변경 중…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
