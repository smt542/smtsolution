import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "HQ 로그인 · 관리비서",
};

export default function PlatformAdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F8FF] px-5 py-10 sm:px-8">
      <div className="w-full max-w-[460px]">
        <section className="rounded-[28px] border border-[#DCE8FA] bg-white px-6 py-8 shadow-[0_24px_70px_rgba(49,130,246,0.12)] sm:px-10 sm:py-10">
          <header className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue text-white shadow-[0_10px_24px_rgba(49,130,246,0.28)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true">
                <path d="M4 11l8-6 8 6M6 10v9h12v-9M10 19v-5h4v5" />
              </svg>
            </div>
            <p className="mt-4 text-[22px] font-extrabold tracking-tight text-t1">관리비서</p>
            <p className="mt-1 text-[11px] font-extrabold tracking-[0.2em] text-blue">HQ CONSOLE</p>
            <h1 className="mt-7 text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-t1">
              모든 관리업체를 한 콘솔에서
            </h1>
            <p className="mt-3 text-[13px] font-medium leading-6 text-t3">
              테넌트 계약과 사용량, 이관 현황을 본사에서 관리합니다. 입주자 개인정보는 조회되지 않으며 모든 접근은 기록됩니다.
            </p>
          </header>

          <div className="mt-8">
            <LoginForm />
          </div>

          <p className="mt-6 border-t border-line pt-5 text-center text-[11.5px] font-medium leading-5 text-t4">
            본사 관리자만 접근할 수 있는 콘솔입니다. 모든 로그인과 대리 접속은 감사 로그에 기록됩니다.
          </p>
        </section>

        <footer className="mt-6 text-center text-xs font-medium text-[#7C8BA1]">
          © 2026 관리비서 · 본사 전용 콘솔
        </footer>
      </div>
    </main>
  );
}
