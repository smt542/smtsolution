import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./LoginForm";
import { SESSION_SWITCHED_ERROR, SESSION_SWITCHED_MESSAGE } from "@/lib/auth/sessionSwitched";

export const metadata: Metadata = {
  title: "HQ 로그인 · 관리비서",
};

export default async function PlatformAdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  // 다른 역할 로그인으로 세션을 끊고 보낸 경우 안내 문구를 띄운다.
  const initialError = error === SESSION_SWITCHED_ERROR ? SESSION_SWITCHED_MESSAGE : undefined;
  return (
    <main className="flex min-h-screen flex-col bg-white lg:flex-row">
      <section className="relative flex min-h-[300px] flex-col justify-between overflow-hidden bg-[linear-gradient(160deg,#0E1E33_0%,#16375A_58%,#1F4E7A_100%)] px-8 py-9 text-white sm:px-12 sm:py-11 lg:min-h-screen lg:flex-1 lg:px-16 lg:py-14">
        <div className="absolute -right-36 -top-32 h-[460px] w-[460px] rounded-full bg-white/[0.07]" />
        <div className="absolute -bottom-44 right-14 h-[360px] w-[360px] rounded-full bg-white/[0.06]" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white">
            <Image src="/logo-mark.png" alt="" width={26} height={26} className="h-[26px] w-[26px] object-contain" priority />
          </div>
          <div>
            <div className="text-[19px] font-extrabold tracking-tight">관리비서</div>
            <div className="mt-0.5 text-[10.5px] font-bold tracking-[0.1em] text-white/60">HQ CONSOLE</div>
          </div>
        </div>

        <div className="relative my-10 max-w-[600px] lg:my-16">
          <h1 className="text-[34px] font-extrabold leading-[1.28] tracking-[-0.03em] sm:text-[42px] lg:text-5xl">
            모든 관리업체를<br />한 콘솔에서
          </h1>
          <p className="mt-4 max-w-[580px] text-[15px] font-medium leading-7 text-white/85 sm:text-base lg:mt-5 lg:text-lg lg:leading-[1.7]">
            테넌트 계약과 사용량, 이관 현황을 본사에서 관리합니다. 입주자 개인정보는 조회되지 않으며 모든 접근은 기록됩니다.
          </p>
        </div>

        <footer className="relative text-xs font-medium text-white/60">
          © 2026 관리비서 · 본사 전용 콘솔
        </footer>
      </section>

      <section className="flex flex-1 items-center justify-center bg-white px-6 py-12 sm:px-12 lg:flex-[0_0_480px] lg:px-14">
        <div className="w-full max-w-[368px]">
          <header className="mb-[26px]">
            <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-t1">본사 관리자 로그인</h2>
            <p className="mt-1.5 text-[13.5px] font-medium text-t3">본사 계정으로 로그인해 주세요.</p>
          </header>

          <LoginForm initialError={initialError} />

          <p className="mt-5 text-center text-xs font-medium leading-5 text-t4">
            본사 관리자만 접근할 수 있는 콘솔입니다.<br />모든 로그인과 대리 접속은 감사 로그에 기록됩니다.
          </p>
        </div>
      </section>
    </main>
  );
}
