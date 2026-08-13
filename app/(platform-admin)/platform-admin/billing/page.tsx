"use client";

import { EmptyState, Spinner } from "@/components/common";
import { usePlatformTransactions } from "@/hooks/reactquery/platform";
import { PageHeader, QueryError } from "../../_components/PageElements";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });
const num = (n: number) => n.toLocaleString("ko-KR");

export default function PlatformBillingPage() {
  const { data = [], isPending, isError, refetch } = usePlatformTransactions({ type: "charge" });
  const totalKrw = data.reduce((s, t) => s + (t.amountKrw ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-6 lg:p-8">
      <PageHeader eyebrow="BILLING" title="청구 관리" description="포인트 충전 결제(청구) 내역을 조회합니다." />

      <section className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h3 className="text-base font-extrabold text-t1">충전 결제 내역</h3>
          <p className="text-xs text-t3">
            누적 결제액 <span className="font-extrabold text-t1 num">{num(totalKrw)}</span> 원
          </p>
        </div>
        {isPending ? (
          <div className="py-16"><Spinner /></div>
        ) : isError ? (
          <div className="p-4"><QueryError onRetry={() => void refetch()} /></div>
        ) : data.length === 0 ? (
          <EmptyState message="충전 결제 내역이 없습니다" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg/70 text-left text-xs font-bold text-t3">
                  <th className="px-5 py-3">일시</th><th className="px-4 py-3">조직</th>
                  <th className="px-4 py-3 text-right">결제액(원)</th><th className="px-4 py-3 text-right">포인트</th>
                  <th className="px-4 py-3">메모</th><th className="px-5 py-3">기록자</th>
                </tr>
              </thead>
              <tbody>
                {data.map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-0 hover:bg-bg/50">
                    <td className="px-5 py-4 text-t2 num">{dateFmt.format(new Date(t.createdAt))}</td>
                    <td className="px-4 py-4 font-bold text-t1">{t.organizationName}</td>
                    <td className="px-4 py-4 text-right font-extrabold text-t1 num">{num(t.amountKrw ?? 0)}</td>
                    <td className="px-4 py-4 text-right font-bold text-green num">+{num(t.points)}</td>
                    <td className="px-4 py-4 text-t3">{t.memo ?? "—"}</td>
                    <td className="px-5 py-4 text-t3">{t.createdByName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
