"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { EmptyState, Spinner, Button, Modal, SearchBar } from "@/components/common";
import {
  listPlatformOrganizations,
  platformKeys,
  useAdjustPoints,
  useMessagePointRates,
  usePlatformTransactions,
  usePointReservations,
  useChargePoints,
  useReleaseStalePointReservation,
  useSetMessagePointRates,
  type PointReservation,
  type PointReservationStatus,
  type PointTxType,
  type PlatformOrganizationQuery,
} from "@/hooks/reactquery/platform";
import type { PointAdjustmentFormValues } from "@/components/forms/schema/pointAdjustment";
import { toast } from "sonner";
import {
  PageHeader,
  PlatformPagination,
  QueryError,
  StatusBadge,
} from "../../_components/PageElements";
const PointChargeModal = dynamic(() =>
  import("./components/PointChargeModal").then((module) => module.PointChargeModal),
);
const PointAdjustmentModal = dynamic(() =>
  import("./components/PointAdjustmentModal").then((module) => module.PointAdjustmentModal),
);
const MessagePointRateModal = dynamic(() =>
  import("./components/MessagePointRateModal").then((module) => module.MessagePointRateModal),
);
const ReservationReleaseModal = dynamic(() =>
  import("./components/ReservationReleaseModal").then((module) => module.ReservationReleaseModal),
);

const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });
const num = (n: number) => n.toLocaleString("ko-KR");
const ORGANIZATION_PAGE_SIZE = 25;
const RESERVATION_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;
const MODAL_ORGANIZATION_QUERY = { pageSize: 100 } satisfies PlatformOrganizationQuery;
const ACTIVE_RESERVATION_STATUSES: PointReservationStatus[] = [
  "reserved",
  "provider_pending",
  "reconcile_required",
];

function useDebouncedValue(value: string) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedValue(value),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [value]);

  return debouncedValue;
}

export default function PlatformPointsPage() {
  const [search, setSearch] = useState("");
  const [organizationPage, setOrganizationPage] = useState(1);
  const [reservationPage, setReservationPage] = useState(1);
  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<PointReservation | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());
  const organizationQuery = useMemo<PlatformOrganizationQuery>(() => ({
    search: debouncedSearch,
    page: organizationPage,
    pageSize: ORGANIZATION_PAGE_SIZE,
  }), [debouncedSearch, organizationPage]);
  const orgsQuery = useQuery({
    queryKey: platformKeys.organizations(organizationQuery),
    queryFn: () => listPlatformOrganizations(organizationQuery),
    placeholderData: keepPreviousData,
  });
  const modalOrgsQuery = useQuery({
    queryKey: platformKeys.organizations(MODAL_ORGANIZATION_QUERY),
    queryFn: () => listPlatformOrganizations(MODAL_ORGANIZATION_QUERY),
    enabled: chargeModalOpen || adjustmentModalOpen,
  });
  const txQuery = usePlatformTransactions();
  const ratesQuery = useMessagePointRates();
  const reservationsQuery = usePointReservations({
    statuses: ACTIVE_RESERVATION_STATUSES,
    page: reservationPage,
    pageSize: RESERVATION_PAGE_SIZE,
  });
  const charge = useChargePoints();
  const adjustment = useAdjustPoints();
  const setRates = useSetMessagePointRates();
  const releaseReservation = useReleaseStalePointReservation();

  const organizations = useMemo(
    () => orgsQuery.data?.rows ?? [],
    [orgsQuery.data],
  );
  const modalOrganizations = useMemo(
    () => (modalOrgsQuery.data?.rows ?? []).filter((o) => !o.deletedAt),
    [modalOrgsQuery.data],
  );
  const transactions = useMemo(
    () => txQuery.data?.pages.flatMap((page) => page.rows) ?? [],
    [txQuery.data],
  );
  const activeRates = useMemo(
    () => new Map((ratesQuery.data ?? []).filter((rate) => rate.isActive).map((rate) => [rate.channel, rate.points])),
    [ratesQuery.data],
  );
  const activeReservations = useMemo(
    () => reservationsQuery.data?.rows ?? [],
    [reservationsQuery.data],
  );
  const pickerUnavailable = modalOrgsQuery.data
    ? modalOrganizations.length === 0
    : orgsQuery.isPending
      || (debouncedSearch === "" && organizations.length === 0);

  const handleCharge = async (values: { orgId: number; points: number; amountKrw: number; memo?: string }) => {
    try {
      await charge.mutateAsync(values);
      toast.success("포인트 충전을 기록했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "충전 기록에 실패했습니다.");
      throw e;
    }
  };

  const handleAdjustment = async (values: PointAdjustmentFormValues) => {
    try {
      await adjustment.mutateAsync(values);
      toast.success("포인트 조정을 기록했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "포인트 조정에 실패했습니다.");
      throw error;
    }
  };

  const handleRates = async (values: { smsPoints: number; alimtalkPoints: number; lmsPoints?: number }) => {
    try {
      await setRates.mutateAsync(values);
      toast.success("메시지 포인트 단가를 변경했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "단가 변경에 실패했습니다.");
      throw error;
    }
  };

  const handleRelease = async (reason: string) => {
    if (!releaseTarget) return;
    try {
      await releaseReservation.mutateAsync({ id: releaseTarget.id, reason });
      toast.success("포인트 예약을 해제했습니다.");
      setReleaseTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "예약 해제에 실패했습니다.");
      throw error;
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-6 lg:p-8">
      <PageHeader eyebrow="POINTS" title="포인트 관리" description="조직별 발송 크레딧(포인트) 잔액과 충전·사용·조정 내역을 관리합니다." />

      <section className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-t1">메시지 채널 단가</h3>
            <p className="mt-1 text-xs text-t3">새 견적부터 현재 활성 단가가 적용됩니다.</p>
          </div>
          <Button
            variant="ghost"
            onClick={() => setRateModalOpen(true)}
            disabled={ratesQuery.isPending || ratesQuery.isError}
          >
            단가 설정
          </Button>
        </div>
        {ratesQuery.isPending ? (
          <div className="py-6"><Spinner /></div>
        ) : ratesQuery.isError ? (
          <div className="mt-3"><QueryError onRetry={() => void ratesQuery.refetch()} /></div>
        ) : (
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <RateSummary label="SMS" points={activeRates.get("sms") ?? 0} />
            <RateSummary label="LMS" points={activeRates.get("lms") ?? 0} />
            <RateSummary label="알림톡" points={activeRates.get("alimtalk") ?? 0} />
          </dl>
        )}
      </section>

      {/* 잔액 목록 */}
      <section className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-extrabold text-t1">조직별 포인트 잔액</h3>
            <p className="mt-1 text-xs text-t3">총 {num(orgsQuery.data?.totalCount ?? 0)}개 조직</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <div className="w-full sm:w-64">
              <SearchBar
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  setOrganizationPage(1);
                }}
                placeholder="조직명 검색"
              />
            </div>
            <Button variant="ghost" onClick={() => setAdjustmentModalOpen(true)} disabled={pickerUnavailable}>포인트 조정</Button>
            <Button variant="primary" onClick={() => setChargeModalOpen(true)} disabled={pickerUnavailable}>충전 기록</Button>
          </div>
        </div>
        {orgsQuery.isPending ? (
          <div className="py-16"><Spinner /></div>
        ) : orgsQuery.isError ? (
          <div className="p-4"><QueryError onRetry={() => void orgsQuery.refetch()} /></div>
        ) : organizations.length === 0 ? (
          <EmptyState message={search ? "검색 결과가 없습니다" : "조회 가능한 조직이 없습니다"} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg/70 text-left text-xs font-bold text-t3">
                  <th className="px-5 py-3">조직</th><th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3 text-right">원장 잔액</th>
                  <th className="px-4 py-3 text-right">예약</th>
                  <th className="px-5 py-3 text-right">가용 잔액</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0 hover:bg-bg/50">
                    <td className="px-5 py-4 font-bold text-t1">{o.name}</td>
                    <td className="px-4 py-4"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-4 text-right text-t2 num">{num(o.ledgerBalance)} P</td>
                    <td className="px-4 py-4 text-right text-amber num">{num(o.reservedPoints)} P</td>
                    <td className="px-5 py-4 text-right font-extrabold text-t1 num">{num(o.availablePoints)} P</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PlatformPagination
          page={organizationPage}
          pageSize={ORGANIZATION_PAGE_SIZE}
          totalCount={orgsQuery.data?.totalCount ?? 0}
          onPageChange={setOrganizationPage}
        />
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="border-b border-line p-4">
          <h3 className="text-base font-extrabold text-t1">활성 메시지 포인트 예약</h3>
          <p className="mt-1 text-xs text-t3">
            만료만으로 자동 해제하지 않습니다. 공급자 상태 확인이 필요한 예약은 수동 검토하세요.
          </p>
        </div>
        {reservationsQuery.data?.hasReconcileRequired && (
          <p className="m-4 rounded-xl bg-danger/10 px-4 py-3 text-sm font-extrabold text-danger">
            공급자 결과 확인이 필요한 예약이 있습니다.
          </p>
        )}
        {reservationsQuery.isPending ? (
          <div className="py-12"><Spinner /></div>
        ) : reservationsQuery.isError ? (
          <div className="p-4"><QueryError onRetry={() => void reservationsQuery.refetch()} /></div>
        ) : activeReservations.length === 0 ? (
          <EmptyState message="활성 예약이 없습니다" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg/70 text-left text-xs font-bold text-t3">
                  <th className="px-5 py-3">조직</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3 text-right">예약 포인트</th>
                  <th className="px-4 py-3">생성</th>
                  <th className="px-4 py-3">만료 기준</th>
                  <th className="px-5 py-3 text-right">운영</th>
                </tr>
              </thead>
              <tbody>
                {activeReservations.map((reservation) => {
                  return (
                    <tr key={reservation.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-4 font-bold text-t1">{reservation.organizationName}</td>
                      <td className="px-4 py-4"><ReservationStatus status={reservation.status} /></td>
                      <td className="px-4 py-4 text-right font-bold num">{num(reservation.reservedPoints)} P</td>
                      <td className="px-4 py-4 text-t3">{formatAge(reservation.ageSeconds)} 전</td>
                      <td className="px-4 py-4 text-t3 num">{dateFmt.format(new Date(reservation.expiresAt))}</td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="ghost"
                          disabled={!reservation.isReleasable}
                          onClick={() => setReleaseTarget(reservation)}
                        >
                          수동 해제
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <PlatformPagination
          page={reservationPage}
          pageSize={RESERVATION_PAGE_SIZE}
          totalCount={reservationsQuery.data?.totalCount ?? 0}
          onPageChange={setReservationPage}
        />
      </section>

      {/* 내역 */}
      <section className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="border-b border-line p-4"><h3 className="text-base font-extrabold text-t1">충전·사용·조정 내역</h3></div>
        {txQuery.isPending ? (
          <div className="py-16"><Spinner /></div>
        ) : txQuery.isError ? (
          <div className="p-4"><QueryError onRetry={() => void txQuery.refetch()} /></div>
        ) : transactions.length === 0 ? (
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
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-0 hover:bg-bg/50">
                    <td className="px-5 py-4 text-t2 num">{dateFmt.format(new Date(t.createdAt))}</td>
                    <td className="px-4 py-4 text-t1">{t.organizationName}</td>
                    <td className="px-4 py-4">
                      <TransactionTypeBadge type={t.type} />
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
        {txQuery.hasNextPage && (
          <div className="flex justify-center border-t border-line p-3">
            <Button
              variant="ghost"
              onClick={() => void txQuery.fetchNextPage()}
              disabled={txQuery.isFetchingNextPage}
            >
              {txQuery.isFetchingNextPage ? "불러오는 중" : "내역 더 보기"}
            </Button>
          </div>
        )}
      </section>

      {chargeModalOpen && (
        modalOrgsQuery.isPending || modalOrgsQuery.isError ? (
          <OrganizationPickerQueryModal
            title="포인트 충전 기록"
            isError={modalOrgsQuery.isError}
            onClose={() => setChargeModalOpen(false)}
            onRetry={() => void modalOrgsQuery.refetch()}
          />
        ) : (
          <PointChargeModal
            open
            onClose={() => setChargeModalOpen(false)}
            organizations={modalOrganizations}
            onSubmit={handleCharge}
            isPending={charge.isPending}
          />
        )
      )}
      {adjustmentModalOpen && (
        modalOrgsQuery.isPending || modalOrgsQuery.isError ? (
          <OrganizationPickerQueryModal
            title="포인트 조정"
            isError={modalOrgsQuery.isError}
            onClose={() => setAdjustmentModalOpen(false)}
            onRetry={() => void modalOrgsQuery.refetch()}
          />
        ) : (
          <PointAdjustmentModal
            open
            onClose={() => setAdjustmentModalOpen(false)}
            organizations={modalOrganizations}
            onSubmit={handleAdjustment}
            isPending={adjustment.isPending}
          />
        )
      )}
      {rateModalOpen && (
        <MessagePointRateModal
          open
          onClose={() => setRateModalOpen(false)}
          smsPoints={activeRates.get("sms") ?? 1}
          alimtalkPoints={activeRates.get("alimtalk") ?? 1}
          lmsPoints={activeRates.get("lms")}
          onSubmit={handleRates}
          isPending={setRates.isPending}
        />
      )}
      {releaseTarget && (
        <ReservationReleaseModal
          key={releaseTarget.id}
          reservation={releaseTarget}
          onClose={() => setReleaseTarget(null)}
          onSubmit={handleRelease}
          isPending={releaseReservation.isPending}
        />
      )}
    </div>
  );
}

function OrganizationPickerQueryModal({
  title,
  isError,
  onClose,
  onRetry,
}: {
  title: string;
  isError: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <Modal open onClose={onClose} title={title}>
      {isError ? <QueryError onRetry={onRetry} /> : <Spinner />}
    </Modal>
  );
}

function RateSummary({ label, points }: { label: string; points: number }) {
  return (
    <div className="rounded-xl bg-bg px-4 py-3">
      <dt className="text-xs font-bold text-t3">{label}</dt>
      <dd className="mt-1 text-lg font-extrabold text-t1">건당 {num(points)} P</dd>
    </div>
  );
}

function ReservationStatus({ status }: { status: PointReservation["status"] }) {
  const view = status === "reconcile_required"
    ? { label: "확인 필요", className: "bg-red-t text-red" }
    : status === "provider_pending"
      ? { label: "발송 중", className: "bg-blue-t text-blue" }
      : { label: "예약", className: "bg-amber-t text-amber" };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${view.className}`}>
      {view.label}
    </span>
  );
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간`;
  return `${Math.floor(seconds / 86400)}일`;
}

const TRANSACTION_BADGES: Record<PointTxType, { label: string; className: string }> = {
  charge: { label: "충전", className: "bg-green-t text-green" },
  usage: { label: "사용", className: "bg-amber-t text-amber" },
  adjustment: { label: "조정", className: "bg-blue-t text-blue" },
};

function TransactionTypeBadge({ type }: { type: PointTxType }) {
  const badge = TRANSACTION_BADGES[type];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.className}`}>
      {badge.label}
    </span>
  );
}
