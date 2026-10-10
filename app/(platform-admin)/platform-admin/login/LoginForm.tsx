"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { FormField } from "@/components/common/FormField";
import { setSubmissionError } from "@/components/forms/formErrors";
import {
  loginSchema,
  type LoginFormInput,
  type LoginFormValues,
} from "@/components/forms/schema/auth";
import { persistRememberedId, readRememberedId } from "@/lib/auth/sessionPersistence";
import { Button, Input } from "@/components/common";

const fieldClass =
  "h-12 w-full rounded-[13px] border border-line bg-white px-3.5 text-[14.5px] font-medium text-t1 outline-none transition placeholder:text-t4 focus:border-blue focus:ring-[3px] focus:ring-blue-t";

export function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "", autoLogin: false },
    shouldFocusError: true,
  });

  // 자동 로그인 = 아이디 유지(정책 2026-08-14): 저장된 아이디가 있으면 채우고 체크 상태로 둔다.
  useEffect(() => {
    const remembered = readRememberedId("platform");
    if (remembered) reset({ username: remembered, password: "", autoLogin: true });
  }, [reset]);

  const submit = async (values: LoginFormValues) => {
    try {
      const response = await fetch("/api/platform/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: values.username, password: values.password }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "로그인에 실패했습니다.");
      }

      persistRememberedId("platform", values.autoLogin ?? false, values.username);
      // 로그인 전 캐시(이전 세션의 '로그인 정보 없음' 등)를 비운다. 남겨 두면 권한 가드가
      // 새 세션을 다시 조회하지 않고 '로그인이 필요합니다'를 띄운다.
      queryClient.clear();

      toast.success("로그인되었습니다");
      router.push("/platform-admin");
      router.refresh();
    } catch (error) {
      setSubmissionError(error, setError, "잠시 후 다시 시도해 주세요.");
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-3.5" noValidate>
      <FormField
        className="flex flex-col gap-[7px]"
        htmlFor="hq-username"
        label="아이디"
        error={errors.username?.message}
      >
        <Input
          unstyled
          id="hq-username"
          type="text"
          autoComplete="username"
          {...register("username")}
          placeholder="아이디를 입력해 주세요"
          className={fieldClass}
        />
      </FormField>

      <FormField
        className="flex flex-col gap-[7px]"
        htmlFor="hq-password"
        label="비밀번호"
        error={errors.password?.message}
      >
        <span className="relative flex items-center">
          <Input
            unstyled
            id="hq-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            {...register("password")}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "hq-password-error" : undefined}
            placeholder="비밀번호를 입력해 주세요"
            className={`${fieldClass} pr-12`}
          />
          <button
            type="button"
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
            className={`absolute right-2 flex h-8 w-8 items-center justify-center rounded-lg ${showPassword ? "text-blue" : "text-t4"}`}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </span>
      </FormField>

      <label className="flex cursor-pointer select-none items-center gap-2 text-[13.5px] font-semibold text-t2">
        <input
          type="checkbox"
          {...register("autoLogin")}
          className="peer sr-only"
        />
        <span
          className="flex h-[19px] w-[19px] flex-none items-center justify-center rounded-md border-[1.6px] border-line bg-white transition-colors peer-checked:border-blue peer-checked:bg-blue peer-checked:[&_svg]:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-blue/40"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 opacity-0 peer-checked:opacity-100" aria-hidden="true">
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
        </span>
        자동 로그인
      </label>

      {errors.root?.server?.message && (
        <div role="alert" className="rounded-xl bg-red-t px-3 py-2.5 text-sm font-bold text-red">
          {errors.root.server.message}
        </div>
      )}

      <Button
        variant="primary"
        size="login"
        type="submit"
        disabled={isSubmitting}
        className="mt-1.5 w-full shadow-none transition disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "로그인 중…" : "로그인"}
      </Button>
    </form>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M3 3l18 18M10.6 10.6a2.8 2.8 0 0 0 3.8 3.8M9.4 5.2A9.3 9.3 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 6.2A17 17 0 0 0 2 12s3.6 7 10 7a9.3 9.3 0 0 0 3-.5" />
    </svg>
  );
}
