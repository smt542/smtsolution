"use client";

import Link from "next/link";
import { Spinner } from "@/components/common";
import { usePlatformOverview } from "@/hooks/reactquery/platform";
import { DataScopeNotice, PageHeader, QueryError } from "../_components/PageElements";

const SUMMARY_CARDS = [
  {
    key: "organizationCount" as const,
    label: "조회 가능 조직",
    description: "RLS 범위의 활성 조직",
    color: "bg-blue-t text-blue",
    icon: "M4 21h16M6 21V7l6-3 6 3v14M9 10h2m2 0h2m-6 4h2m2 0h2",
  },
  {
    key: "accountCount" as const,
    label: "소속 계정",
    description: "조회 가능한 org_members",
    color: "bg-green-t text-green",
    icon: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21a8 8 0 0 1 16 0",
  },
  {
    key: "buildingCount" as const,
    label: "운영 건물",
    description: "삭제되지 않은 건물",
    color: "bg-amber-t text-amber",
    icon: "M5 21V5h14v16M9 9h2m2 0h2m-6 4h2m2 0h2m-6 4h6",
  },
];

export default function PlatformDashboardPage() {
  const { data, isPending, isError, refetch } = usePlatformOverview();

  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="PLATFORM OVERVIEW"
        title="플랫폼 운영 현황"
        description="현재 계정에 허용된 조직, 계정, 건물 데이터를 한눈에 확인합니다."
      />

      <div className="mt-5">
        <DataScopeNotice />
      </div>

      <section className="mt-6" aria-label="플랫폼 요약">
        {isPending ? (
          <div className="rounded-2xl bg-white py-16"><Spinner /></div>
        ) : isError || !data ? (
          <QueryError onRetry={() => void refetch()} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SUMMARY_CARDS.map((card) => (
              <article key={card.key} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-t2">{card.label}</div>
                    <div className="mt-3 text-[32px] font-extrabold leading-none text-t1 num">{data[card.key].toLocaleString("ko-KR")}</div>
                    <div className="mt-2 text-xs text-t4">{card.description}</div>
                  </div>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.color}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                      <path d={card.icon} />
                    </svg>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h3 className="text-base font-extrabold text-t1">빠른 이동</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <QuickLink href="/platform-admin/organizations" title="조직 목록 보기" description="조직 상태와 건물·계정 수 확인" />
          <QuickLink href="/platform-admin/accounts" title="계정 목록 보기" description="조직별 소속 계정과 활성 상태 확인" />
        </div>
      </section>
    </div>
  );
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="group flex items-center justify-between rounded-2xl border border-line px-4 py-4 hover:border-[#B9D2FA] hover:bg-blue-t2">
      <span>
        <span className="block text-sm font-bold text-t1">{title}</span>
        <span className="mt-1 block text-xs text-t3">{description}</span>
      </span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-t4 group-hover:text-blue" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  );
}
