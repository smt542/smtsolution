import Image from "next/image";
import { LoginForm } from "./components/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-white">
      {/* 좌측 브랜드 히어로 (데스크톱 전용) */}
      <aside className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-[linear-gradient(160deg,#0E8677_0%,#14A497_58%,#31BFAF_100%)] px-16 py-14 text-white lg:flex">
        <div aria-hidden className="pointer-events-none absolute -right-36 -top-32 h-[460px] w-[460px] rounded-full bg-white/[0.07]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-44 right-16 h-[360px] w-[360px] rounded-full bg-white/[0.06]" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white">
            <Image src="/logo-mark.png" alt="" width={26} height={26} className="h-[26px] w-[26px] object-contain" priority />
          </div>
          <span className="text-[19px] font-extrabold tracking-tight">관리비서</span>
        </div>

        <div className="relative max-w-[600px]">
          <h2 className="text-pretty text-[48px] font-extrabold leading-[1.28] tracking-[-0.03em]">건물관리, 이제 한 곳에서</h2>
          <p className="mt-5 text-[18px] font-medium leading-[1.7] text-white/[0.86]">관리비 부과부터 수납, 민원, 이사정산까지 건물관리 업무 전체를 하나의 플랫폼에서 처리하세요.</p>
        </div>

        <div className="relative text-[12.5px] font-medium text-white/[0.62]">© 2026 관리비서 · 업무용 시스템</div>
      </aside>

      {/* 우측 로그인 폼 */}
      <main className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-[480px] lg:flex-none lg:px-14">
        <div className="w-full max-w-[368px]">
          <div className="mb-[26px]">
            <h1 className="text-2xl font-extrabold tracking-[-0.02em]">로그인</h1>
            <p className="mt-1.5 text-[13.5px] font-medium text-t3">발급받은 계정으로 로그인해 주세요.</p>
          </div>
          <LoginForm />
          <p className="mt-5 text-center text-xs font-medium leading-[1.7] text-t4">
            계정 문의는 마스터 관리자에게 요청해 주세요.<br />문의 : 042-632-8770
          </p>
        </div>
      </main>
    </div>
  );
}
