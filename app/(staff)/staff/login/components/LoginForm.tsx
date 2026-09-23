"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { FormField } from "@/components/common/FormField";
import { setSubmissionError } from "@/components/forms/formErrors";
import {
  loginSchema,
  type LoginFormInput,
  type LoginFormValues,
} from "@/components/forms/schema/auth";
import { useLogin } from "@/hooks/reactquery/auth";
import { AUTO_LOGIN_KEY } from "@/lib/auth/sessionPersistence";
import { Button } from "@/components/common";

const fieldBase =
  "h-12 rounded-[13px] border border-line bg-white text-[14.5px] font-medium text-t1 placeholder:text-[#757575] outline-none transition focus:border-[#14A497] focus:ring-[3px] focus:ring-blue-t";
export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const [showPw, setShowPw] = useState(false);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "", autoLogin: false },
    shouldFocusError: true,
  });
  const submitting = login.isPending || isSubmitting;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const ctx = await login.mutateAsync({ username: values.username, password: values.password, autoLogin: values.autoLogin ?? false });
      if (values.autoLogin) localStorage.setItem(AUTO_LOGIN_KEY, "1");
      else localStorage.removeItem(AUTO_LOGIN_KEY);
      if (ctx?.mustChangePassword) toast.info("비밀번호 변경이 필요합니다. 관리자 안내에 따라 변경해 주세요.");
      router.push(ctx.role === "platform_admin" ? "/platform-admin" : "/staff/receipts");
    } catch (e) {
      setSubmissionError(e, setError, "잠시 후 다시 시도해 주세요.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
      <FormField htmlFor="username" label="아이디" error={errors.username?.message} className="flex flex-col gap-[7px]">
        <input id="username" autoComplete="username" placeholder="아이디를 입력해 주세요"
          className={`${fieldBase} px-3.5`} {...register("username")} />
      </FormField>
      <FormField htmlFor="password" label="비밀번호" error={errors.password?.message} className="flex flex-col gap-[7px]">
        <div className="relative flex items-center">
          <input id="password" type={showPw ? "text" : "password"} autoComplete="current-password" placeholder="비밀번호를 입력해 주세요"
            className={`${fieldBase} w-full pl-3.5 pr-12`} {...register("password")}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined} />
          <button type="button" aria-label="비밀번호 보기" onClick={() => setShowPw((v) => !v)}
            className={`absolute right-2 flex h-8 w-8 items-center justify-center rounded-[9px] ${showPw ? "text-blue" : "text-t4"}`}>
            {showPw ? (
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
            )}
          </button>
        </div>
      </FormField>
      <label className="flex cursor-pointer select-none items-center gap-2 text-[13.5px] font-semibold text-t2">
        <input type="checkbox" className="peer sr-only" {...register("autoLogin")} />
        <span className="flex h-[19px] w-[19px] flex-none items-center justify-center rounded-md border-[1.6px] border-line bg-white transition-colors peer-checked:border-blue peer-checked:bg-blue peer-checked:[&_svg]:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-blue/40">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 opacity-0" aria-hidden="true">
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
        </span>
        자동 로그인
      </label>
      {errors.root?.server?.message && (
        <div role="alert" className="rounded-[11px] bg-red-t px-3 py-2.5 text-sm font-bold text-red">{errors.root.server.message}</div>
      )}
      <Button variant="primary" size="login" type="submit" disabled={submitting}
        className="mt-1.5 shadow-none transition disabled:opacity-70">
        {submitting ? "로그인 중…" : "로그인"}
      </Button>
    </form>
  );
}
