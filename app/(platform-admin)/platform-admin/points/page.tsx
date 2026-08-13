"use client";

import { useMemo, useState } from "react";
import { EmptyState, Spinner, Button, SearchBar } from "@/components/common";
import {
  usePlatformOrganizations,
  usePlatformTransactions,
  useChargePoints,
} from "@/hooks/reactquery/platform";
import { toast } from "sonner";
import { PageHeader, QueryError, StatusBadge } from "../../_components/PageElements";
import { PointChargeModal } from "./components/PointChargeModal";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });
const num = (n: number) => n.toLocaleString("ko-KR");

export default function PlatformPointsPage() {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const orgsQuery = usePlatformOrganizations();
  const txQuery = usePlatformTransactions();
  const charge = useChargePoints();

  const organizations = useMemo(() => orgsQuery.data ?? [], [orgsQuery.data]);
  const filtered = useMemo(() => {
    const kw = search.trim().toLocaleLowerCase("ko-KR");
    if (!kw) return organizations;
    return organizations.filter((o) => o.name.toLocaleLowerCase("ko-KR").includes(kw));
  }, [organizations, search]);

  const handleCharge = async (values: { orgId: number; points: number; amountKrw: number; memo?: string }) => {
    try {
      await charge.mutateAsync(values);
      toast.success("포인트 충전을 기록했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "충전 기록에 실패했습니다.");
      throw e;
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-6 lg:p-8">
      <PageHeader eyebrow="POINTS" title="포인트 관리" description="조직별 발송 크레딧(포인트) 잔액과 충전·사용 내역을 관리합니다." />

      {/* 잔액 목록 */}
      <section className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-extrabold text-t1">조직별 포인트 잔액</h3>
            <p className="mt-1 text-xs text-t3">총 {num(organizations.length)}개 조직</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <div className="w-full sm:w-64"><SearchBar value={search} onChange={setSearch} placeholder="조직명 검색" /></div>
            <Button variant="primary" onClick={() => setModalOpen(true)} disabled={organizations.length === 0}>충전 기록</Button>
          </div>
        </div>
        {orgsQuery.isPending ? (
          <div className="py-16"><Spinner /></div>
        ) : orgsQuery.isError ? (
          <div className="p-4"><QueryError onRetry={() => void orgsQuery.refetch()} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState message={search ? "검색 결과가 없습니다" : "조회 가능한 조직이 없습니다"} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg/70 text-left text-xs font-bold text-t3">
                  <th className="px-5 py-3">조직</th><th className="px-4 py-3">상태</th><th className="px-5 py-3 text-right">포인트 잔액</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0 hover:bg-bg/50">
                    <td className="px-5 py-4 font-bold text-t1">{o.name}</td>
                    <td className="px-4 py-4"><StatusBadge status={o.status} /></td>
                    <td className="px-5 py-4 text-right font-extrabold text-t1 num">{num(o.pointBalance)} P</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 내역 */}
      <section className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="border-b border-line p-4"><h3 className="text-base font-extrabold text-t1">충전·사용 내역</h3></div>
        {txQuery.isPending ? (
          <div className="py-16"><Spinner /></div>
        ) : txQuery.isError ? (
          <div className="p-4"><QueryError onRetry={() => void txQuery.refetch()} /></div>
        ) : (txQuery.data ?? []).length === 0 ? (
          <EmptyState message="내역이 없습니다" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg/70 text-left text-xs font-bold text-t3">
                  <th className="px-5 py-3">일시</th><th className="px-4 py-3">조직</th><th className="px-4 py-3">구분</th>
                  <th className="px-4 py-3 text-right">포인트</th><th className="px-4 py-3">메모</th><th className="px-5 py-3">기록자</th>
                </tr>
              </thead>
              <tbody>
                {(txQuery.data ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-0 hover:bg-bg/50">
                    <td className="px-5 py-4 text-t2 num">{dateFmt.format(new Date(t.createdAt))}</td>
                    <td className="px-4 py-4 text-t1">{t.organizationName}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${t.type === "charge" ? "bg-green-t text-green" : "bg-amber-t text-amber"}`}>
                        {t.type === "charge" ? "충전" : "사용"}
                      </span>
                    </td>
                    <td className={`px-4 py-4 text-right font-bold num ${t.points >= 0 ? "text-green" : "text-red"}`}>{t.points >= 0 ? "+" : ""}{num(t.points)}</td>
                    <td className="px-4 py-4 text-t3">{t.memo ?? "—"}</td>
                    <td className="px-5 py-4 text-t3">{t.createdByName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PointChargeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        organizations={organizations}
        onSubmit={handleCharge}
        isPending={charge.isPending}
      />
    </div>
  );
}
