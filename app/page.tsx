import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "관리비서 | 주택·건물 관리비 통합 관리 서비스",
  description:
    "관리비 부과·고지서 발행부터 수납, 미납관리, 공과금 검침, 문자·알림톡 발송까지 — 주택·건물 관리 업무 전체를 하나의 플랫폼에서 처리하는 관리비 관리 서비스, 관리비서.",
  openGraph: {
    title: "관리비서 | 주택·건물 관리비 통합 관리 서비스",
    description:
      "관리비 부과·수납·미납·공과금·문자발송까지, 건물관리 업무 전체를 하나로.",
    siteName: "관리비서",
    locale: "ko_KR",
    type: "website",
  },
};

/**
 * 공개 회사·연락처 정보 — 사업자등록증(에스엠티솔루션 주식회사) 기준.
 * 연락처(tel/email)는 공개용으로 맞는지 확인 후 교체 가능.
 */
const COMPANY = {
  service: "관리비서",
  corp: "에스엠티솔루션 주식회사",
  ceo: "최서윤",
  bizNo: "542-81-03683",
  addr: "대전광역시 동구 계족로512번길 39, 202호 (용전동)",
  tel: "042-632-8770",
  email: "smt542@naver.com",
};

/** 브랜드 마크 (staff 로그인과 동일한 홈 아이콘) */
function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 11l8-6 8 6" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-5h4v5" />
    </svg>
  );
}

type Feature = { title: string; desc: string; icon: React.ReactNode };

const iconCls = "h-6 w-6";
const iconProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  className: iconCls,
  "aria-hidden": true,
};

const FEATURES: Feature[] = [
  {
    title: "관리비 자동 부과·고지서",
    desc: "세대별 관리비를 자동 산정하고 A4·지로 고지서를 한 번에 발행합니다.",
    icon: (
      <svg {...iconProps}>
        <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M14 3v5h5M8.5 13h7M8.5 17h7" />
      </svg>
    ),
  },
  {
    title: "수납·자동이체",
    desc: "은행 입금내역 자동매칭과 CMS 자동이체로 수납 업무를 자동화합니다.",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </svg>
    ),
  },
  {
    title: "미납·연체 관리",
    desc: "미납 세대를 자동 집계하고 단계별 독촉과 연체료를 관리합니다.",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    title: "공과금 검침",
    desc: "전기·수도·가스 검침 입력부터 세대별 부과까지 한 흐름으로 처리합니다.",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 12l4-2M12 12v-4" />
      </svg>
    ),
  },
  {
    title: "문자·알림톡·팩스",
    desc: "고지서와 안내를 문자·카카오 알림톡·팩스로 통합 발송합니다.",
    icon: (
      <svg {...iconProps}>
        <path d="M4 5h16v11H8l-4 4V5Z" />
        <path d="M8.5 10h7" />
      </svg>
    ),
  },
  {
    title: "세입자 모바일 앱",
    desc: "입주민이 관리비 내역·공지·정산을 앱에서 직접 확인합니다.",
    icon: (
      <svg {...iconProps}>
        <rect x="7" y="3" width="10" height="18" rx="2.5" />
        <path d="M11 18h2" />
      </svg>
    ),
  },
];

const HIGHLIGHTS = [
  {
    title: "업무 자동화",
    desc: "반복되는 부과·수납·독촉을 자동으로 처리해 관리 시간을 줄입니다.",
  },
  {
    title: "실시간 현황",
    desc: "수납률·미납·연체 현황을 실시간 대시보드로 한눈에 확인합니다.",
  },
  {
    title: "완전 통합",
    desc: "사무 관리자·현장 담당자·입주민을 하나의 시스템으로 연결합니다.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface text-t1">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-50 border-b border-line/80 bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-blue text-white shadow-pri">
              <BrandMark className="h-[22px] w-[22px]" />
            </span>
            <span className="text-[18px] font-extrabold tracking-tight">관리비서</span>
          </div>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a
              href="#features"
              className="hidden rounded-btn px-3.5 py-2 text-[14px] font-semibold text-t2 transition-colors hover:text-t1 sm:inline-block"
            >
              기능
            </a>
            <a
              href="#contact"
              className="hidden rounded-btn px-3.5 py-2 text-[14px] font-semibold text-t2 transition-colors hover:text-t1 sm:inline-block"
            >
              도입 문의
            </a>
            <Link
              href="/staff/login"
              className="rounded-btn bg-blue px-4 py-2 text-[14px] font-bold text-white shadow-pri transition-colors hover:bg-blue-d"
            >
              로그인
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ===== Hero ===== */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1100px_520px_at_75%_-10%,#E2F5F1_0%,transparent_60%)]"
          />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-blue-t px-3 py-1.5 text-[12.5px] font-bold text-blue-d">
                주택·건물 관리 올인원
              </span>
              <h1 className="mt-5 text-balance text-[38px] font-extrabold leading-[1.22] tracking-[-0.03em] sm:text-[52px]">
                건물관리,
                <br />
                이제 한 곳에서
              </h1>
              <p className="mt-5 max-w-[520px] text-pretty text-[16px] font-medium leading-[1.7] text-t2 sm:text-[18px]">
                관리비 부과부터 수납, 미납관리, 공과금 검침, 문자·알림톡
                발송까지. 건물관리 업무 전체를 하나의 플랫폼에서 처리하세요.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="#contact"
                  className="rounded-btn bg-blue px-6 py-3.5 text-[15px] font-bold text-white shadow-pri transition-colors hover:bg-blue-d"
                >
                  도입 문의하기
                </a>
                <Link
                  href="/staff/login"
                  className="rounded-btn border border-line bg-surface px-6 py-3.5 text-[15px] font-bold text-t1 transition-colors hover:bg-bg"
                >
                  로그인
                </Link>
              </div>
            </div>

            {/* 제품 목업 (CSS) */}
            <div className="relative">
              <div className="rounded-[22px] border border-line bg-surface p-4 shadow-pop">
                <div className="rounded-[16px] bg-bg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue text-white">
                        <BrandMark className="h-4 w-4" />
                      </span>
                      <span className="text-[13px] font-extrabold">관리비서 대시보드</span>
                    </div>
                    <span className="rounded-pill bg-green-t px-2.5 py-1 text-[11px] font-bold text-green">
                      이번 달 수납률 92%
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2.5">
                    {[
                      { k: "부과 세대", v: "128" },
                      { k: "수납 완료", v: "118" },
                      { k: "미납", v: "10" },
                    ].map((s) => (
                      <div key={s.k} className="rounded-[12px] bg-surface p-3 shadow-card">
                        <div className="text-[11px] font-semibold text-t3">{s.k}</div>
                        <div className="num mt-1 text-[19px] font-extrabold tracking-tight">
                          {s.v}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2.5 rounded-[12px] bg-surface p-3.5 shadow-card">
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="text-[12px] font-bold text-t2">월별 수납 추이</span>
                      <span className="text-[11px] font-semibold text-t4">최근 6개월</span>
                    </div>
                    <div className="flex h-20 items-end gap-2">
                      {[46, 58, 52, 70, 64, 82].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t-[5px] bg-blue"
                          style={{ height: `${h}%`, opacity: 0.35 + i * 0.11 }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Features ===== */}
        <section id="features" className="border-t border-line2 bg-bg/60">
          <div className="mx-auto max-w-6xl px-5 py-18 sm:px-8 sm:py-24">
            <div className="max-w-2xl">
              <h2 className="text-[28px] font-extrabold tracking-[-0.02em] sm:text-[34px]">
                관리 업무 전체를 하나로
              </h2>
              <p className="mt-3 text-[15px] font-medium leading-[1.7] text-t2 sm:text-[16px]">
                부과·고지·수납·미납·공과금·발송까지, 흩어져 있던 관리 업무를
                관리비서 한 곳에서 처리합니다.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-card border border-line bg-surface p-6 shadow-card transition-shadow hover:shadow-pop"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-blue-t text-blue-d">
                    {f.icon}
                  </span>
                  <h3 className="mt-4 text-[17px] font-extrabold tracking-tight">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-[14px] font-medium leading-[1.65] text-t2">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-[13.5px] font-medium text-t3">
              그 외 현장 담당자용 모바일 앱, 장기수선충당금·이사정산, 통합관리자
              콘솔까지 지원합니다.
            </p>
          </div>
        </section>

        {/* ===== Highlights ===== */}
        <section className="border-t border-line2">
          <div className="mx-auto max-w-6xl px-5 py-18 sm:px-8 sm:py-24">
            <div className="grid gap-8 sm:grid-cols-3">
              {HIGHLIGHTS.map((h, i) => (
                <div key={h.title}>
                  <div className="num text-[15px] font-extrabold text-blue">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="mt-2 text-[19px] font-extrabold tracking-tight">
                    {h.title}
                  </h3>
                  <p className="mt-2 text-[14.5px] font-medium leading-[1.7] text-t2">
                    {h.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== Target ===== */}
        <section className="border-t border-line2 bg-bg/60">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <h2 className="text-center text-[22px] font-extrabold tracking-[-0.02em] sm:text-[26px]">
              이런 분들을 위한 서비스입니다
            </h2>
            <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-3">
              {["주택관리업체", "건물주·임대사업자", "관리사무소", "위탁관리 현장"].map(
                (t) => (
                  <span
                    key={t}
                    className="rounded-pill border border-line bg-surface px-5 py-2.5 text-[14.5px] font-bold text-t1 shadow-card"
                  >
                    {t}
                  </span>
                ),
              )}
            </div>
          </div>
        </section>

        {/* ===== CTA / Contact ===== */}
        <section id="contact" className="border-t border-line2">
          <div className="mx-auto max-w-6xl px-5 py-18 sm:px-8 sm:py-24">
            <div className="overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#0E8677_0%,#14A497_100%)] px-8 py-12 text-white sm:px-14 sm:py-16">
              <h2 className="text-[26px] font-extrabold leading-[1.3] tracking-[-0.02em] sm:text-[32px]">
                도입을 검토 중이신가요?
              </h2>
              <p className="mt-3 max-w-xl text-[15px] font-medium leading-[1.7] text-white/85 sm:text-[16px]">
                건물 규모와 관리 방식에 맞춰 안내해 드립니다. 편하게 문의해
                주세요.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href={`tel:${COMPANY.tel.replace(/-/g, "")}`}
                  className="rounded-btn bg-white px-6 py-3.5 text-[15px] font-bold text-blue-d transition-colors hover:bg-white/90"
                >
                  전화 문의 {COMPANY.tel}
                </a>
                <a
                  href={`mailto:${COMPANY.email}`}
                  className="rounded-btn border border-white/40 px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-white/10"
                >
                  이메일 문의
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ===== Footer (사업자 정보 = 공개 필수 표기) ===== */}
      <footer className="border-t border-line bg-bg">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-blue text-white">
              <BrandMark className="h-[19px] w-[19px]" />
            </span>
            <span className="text-[16px] font-extrabold tracking-tight">관리비서</span>
          </div>

          <div className="mt-5 space-y-1 text-[13px] font-medium leading-[1.75] text-t3">
            <p>
              <span className="text-t2">{COMPANY.corp}</span>
              <span className="mx-2 text-line">|</span>
              대표 {COMPANY.ceo}
            </p>
            <p>
              사업자등록번호 {COMPANY.bizNo}
              <span className="mx-2 text-line">|</span>
              {COMPANY.addr}
            </p>
            <p>
              고객센터 {COMPANY.tel}
              <span className="mx-2 text-line">|</span>
              <a href={`mailto:${COMPANY.email}`} className="hover:text-t2">
                {COMPANY.email}
              </a>
            </p>
          </div>

          <p className="mt-6 text-[12.5px] font-medium text-t4">
            © 2026 {COMPANY.corp}. 관리비서(gwanribiseo). All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
