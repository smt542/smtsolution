"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authKeys, getMyContext, recordLogin } from "@/hooks/reactquery/auth";
import { AUTO_LOGIN_KEY } from "@/lib/auth/sessionPersistence";
import { createClient } from "@/lib/supabase/client";

const fieldClass =
  "h-12 w-full rounded-[13px] border border-line bg-white px-3.5 text-[14px] font-medium text-t1 outline-none transition placeholder:text-t4 focus:border-blue focus:ring-4 focus:ring-blue/15";

export function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [autoLogin, setAutoLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;

    setErrorMessage("");
    setIsPending(true);
    const supabase = createClient();
    let signedIn = false;

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
      signedIn = true;

      const context = await getMyContext();
      if (context?.role !== "platform_admin") {
        await supabase.auth.signOut();
        signedIn = false;
        throw new Error("본사 관리자 전용 콘솔입니다");
      }

      if (autoLogin) localStorage.setItem(AUTO_LOGIN_KEY, "1");
      else localStorage.removeItem(AUTO_LOGIN_KEY);

      await recordLogin().catch(() => {});
      queryClient.setQueryData(authKeys.me(), context);
      router.push("/platform-admin");
      router.refresh();
    } catch (error) {
      if (signedIn) await supabase.auth.signOut().catch(() => {});
      setErrorMessage(error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1.5" htmlFor="hq-email">
        <span className="text-[12.5px] font-bold text-t3">아이디</span>
        <input
          id="hq-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="본사 관리자 이메일"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5" htmlFor="hq-password">
        <span className="text-[12.5px] font-bold text-t3">비밀번호</span>
        <span className="relative flex items-center">
          <input
            id="hq-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
      </label>

      <label className="flex items-center gap-2 text-[13px] font-semibold text-t2">
        <input
          type="checkbox"
          checked={autoLogin}
          onChange={(event) => setAutoLogin(event.target.checked)}
          className="h-[18px] w-[18px] accent-blue"
        />
        자동 로그인
      </label>

      {errorMessage && (
        <div role="alert" className="rounded-xl bg-red-t px-3 py-2.5 text-sm font-bold text-red">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !email.trim() || !password}
        className="mt-1 h-[50px] rounded-[14px] bg-blue text-[15px] font-extrabold text-white transition hover:bg-blue-d disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "로그인 중…" : "로그인"}
      </button>
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
