"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { loginSchema } from "@/components/forms/schema/auth";
import { useLogin } from "@/hooks/reactquery/auth";
import { AUTO_LOGIN_KEY } from "@/lib/auth/sessionPersistence";

type LoginFormInput = z.input<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "", autoLogin: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    try {
      await login.mutateAsync({ username: values.username, password: values.password, autoLogin: values.autoLogin ?? false });
      if (values.autoLogin) localStorage.setItem(AUTO_LOGIN_KEY, "1");
      else localStorage.removeItem(AUTO_LOGIN_KEY);
      router.push("/staff/receipt-management");
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="text-sm font-bold text-gray-500">아이디</label>
        <input id="username" autoComplete="username" placeholder="아이디를 입력해 주세요"
          className="h-12 rounded-xl border px-3.5" {...register("username")} />
        {errors.username && <p className="text-sm text-red-500">{errors.username.message}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-bold text-gray-500">비밀번호</label>
        <input id="password" type="password" autoComplete="current-password" placeholder="비밀번호를 입력해 주세요"
          className="h-12 rounded-xl border px-3.5" {...register("password")} />
        {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" {...register("autoLogin")} /> 자동 로그인
      </label>
      {serverError && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm font-bold text-red-500">{serverError}</div>
      )}
      <button type="submit" disabled={login.isPending}
        className="h-12 rounded-xl bg-teal-600 font-bold text-white disabled:opacity-70">
        {login.isPending ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
