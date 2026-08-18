"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button, EmptyState, Input, SearchBar, Select, Spinner } from "@/components/common";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  useReceiptPaymentStatus,
  type ReceiptPaymentRow,
} from "@/hooks/reactquery/receipts";
import { currentPeriod, fromMonthInput, toMonthInput } from "@/lib/billing/period";
import type { MessagingPreset } from "@/lib/messaging/preset";
import type { PayStatus } from "@/lib/payments/status";
import { MessagingModal } from "../../messaging/components/MessagingModal";

const STATUS_OPTIONS: { value: "" | PayStatus; label: string }[] = [
  { value: "", label: "전체 수납상태" },
  { value: "unbilled", label: "미부과" },
  { value: "unpaid", label: "미납" },
  { value: "partial", label: "부분수납" },
  { value: "paid", label: "수납완료" },
  { value: "over", label: "초과수납" },
];

const STATUS_STYLE: Record<PayStatus, string> = {
  unbilled: "bg-bg text-t3",
  unpaid: "bg-red-t text-red",
  partial: "bg-amber-t text-amber",
  paid: "bg-green-t text-green",
  over: "bg-blue-t text-blue",
};

function formatCurrency(value: number | null) {
  return value === null ? "-" : `${value.toLocaleString("ko-KR")}원`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function unitLabel(row: Pick<ReceiptPaymentRow, "dong" | "unitNo">) {
  return [row.dong, row.unitNo].filter(Boolean).join(" ");
}

export function paymentDeepLink(
  row: Pick<ReceiptPaymentRow, "buildingId" | "unitId">,
  period: string,
  view: "history" | "statement" | "receipt",
) {
  const params = new URLSearchParams({
    buildingId: String(row.buildingId),
    unitId: String(row.unitId),
    period,
    view,
  });
  return `/staff/payment?${params.toString()}`;
}

export function PaymentStatusSection({
  buildings,
  isBuildingsLoading,
  canSendMessages,
}: {
  buildings: Pick<Building, "id" | "name">[];
  isBuildingsLoading: boolean;
  canSendMessages: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialBuildingId = searchParams.get("buildingId") ?? "";
  const [period, setPeriod] = useState(() => currentPeriod());
  const [search, setSearch] = useState("");
  const [buildingFilter, setBuildingFilter] = useState(initialBuildingId);
  const [unitSearch, setUnitSearch] = useState(() => searchParams.get("unit") ?? "");
  const [tenantSearch, setTenantSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | PayStatus>("");
  const [messagingPreset, setMessagingPreset] = useState<MessagingPreset | null>(null);
  const { data, isLoading, isError, refetch } = useReceiptPaymentStatus(
    buildings,
    period,
    !isBuildingsLoading,
  );

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("ko-KR");
    const normalizedUnit = unitSearch.trim().toLocaleLowerCase("ko-KR");
    const normalizedTenant = tenantSearch.trim().toLocaleLowerCase("ko-KR");

    return data.rows.filter((row) => {
      if (buildingFilter && row.buildingId !== Number(buildingFilter)) return false;
      if (statusFilter && row.payStatus !== statusFilter) return false;
      if (normalizedUnit && !unitLabel(row).toLocaleLowerCase("ko-KR").includes(normalizedUnit)) {
        return false;
      }
      if (
        normalizedTenant
        && !(row.tenantName ?? "").toLocaleLowerCase("ko-KR").includes(normalizedTenant)
      ) {
        return false;
      }
      if (!normalizedSearch) return true;
      return [
        row.buildingName,
        unitLabel(row),
        row.tenantName,
        row.charged,
        row.paid,
        row.unpaid,
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(" ")
        .toLocaleLowerCase("ko-KR")
        .includes(normalizedSearch.replaceAll(",", ""));
    });
  }, [buildingFilter, data.rows, search, statusFilter, tenantSearch, unitSearch]);

  const totals = useMemo(
    () => filteredRows.reduce(
      (sum, row) => ({
        charged: sum.charged + (row.charged ?? 0),
        paid: sum.paid + row.paid,
        unpaid: sum.unpaid + (row.unpaid ?? 0),
      }),
      { charged: 0, paid: 0, unpaid: 0 },
    ),
    [filteredRows],
  );

  const feeItems = useMemo(() => {
    const amounts = new Map<string, number>();
    for (const item of data.feeItems) {
      if (buildingFilter && item.buildingId !== Number(buildingFilter)) continue;
      amounts.set(item.feeItemName, (amounts.get(item.feeItemName) ?? 0) + item.amount);
    }
    return [...amounts.entries()].sort(([a], [b]) => a.localeCompare(b, "ko-KR"));
  }, [buildingFilter, data.feeItems]);

  const hasFilters = Boolean(search || buildingFilter || unitSearch || tenantSearch || statusFilter);

  const resetFilters = () => {
    setSearch("");
    setBuildingFilter("");
    setUnitSearch("");
    setTenantSearch("");
    setStatusFilter("");
  };

  const openAsStatus = () => {
    window.open(
      "/staff/receipts/as-status",
      "receipts-as-status",
      "popup=yes,width=1400,height=900,resizable=yes,scrollbars=yes",
    );
  };

  const openBillMessage = (row: ReceiptPaymentRow) => {
    if (!canSendMessages) {
      toast.info("문자 발송 권한이 필요합니다.");
      return;
    }
    if (!row.phone) {
      toast.info("등록된 입주자 연락처가 없습니다.");
      return;
    }
    setMessagingPreset({
      context: "고지서",
      channel: "sms",
      body: `${row.tenantName ?? "입주자"}님, ${toMonthInput(period)} 관리비 고지 안내입니다. 부과금액 ${formatCurrency(row.charged)}, 납기일 ${row.dueDate ?? "미정"}입니다.`,
      recipients: [{
        name: row.tenantName,
        phone: row.phone,
        unitNo: unitLabel(row),
        kind: "tenant",
        ref: {
          occupancyId: row.occupancyId ?? undefined,
          buildingId: row.buildingId,
        },
      }],
    });
  };

  return (
    <section aria-labelledby="payment-status-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold text-t3">관리업무 · 통합조회</p>
          <h1 id="payment-status-heading" className="text-2xl font-extrabold text-t1">
            수납관리·민원접수
          </h1>
          <p className="mt-1 text-sm text-t3">월별 수납 현황과 민원·AS 업무를 한 화면에서 관리합니다.</p>
        </div>
        <Button type="button" variant="ghost" onClick={openAsStatus}>AS접수현황</Button>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[150px_minmax(220px,1.3fr)_180px_150px_150px_160px_auto]">
          <Input
            aria-label="수납 조회월"
            type="month"
            value={toMonthInput(period)}
            onChange={(event) => setPeriod(fromMonthInput(event.target.value))}
          />
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="건물명·호실·입주자·금액 검색"
          />
          <Select
            aria-label="수납 건물 필터"
            value={buildingFilter}
            onChange={(event) => setBuildingFilter(event.target.value)}
            options={[
              { value: "", label: "전체 건물" },
              ...buildings.map((building) => ({ value: String(building.id), label: building.name })),
            ]}
          />
          <Input
            aria-label="수납 호실 검색"
            value={unitSearch}
            onChange={(event) => setUnitSearch(event.target.value)}
            placeholder="호실"
          />
          <Input
            aria-label="수납 입주자 검색"
            value={tenantSearch}
            onChange={(event) => setTenantSearch(event.target.value)}
            placeholder="입주자"
          />
          <Select
            aria-label="수납상태 필터"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "" | PayStatus)}
            options={STATUS_OPTIONS}
          />
          <Button type="button" variant="ghost" disabled={!hasFilters} onClick={resetFilters}>
            초기화
          </Button>
        </div>
      </div>

      <div aria-label="수납현황 합계" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["조회 세대", `${filteredRows.length.toLocaleString("ko-KR")}세대`],
          ["총부과금액", formatCurrency(totals.charged)],
          ["수납금액", formatCurrency(totals.paid)],
          ["미납금액", formatCurrency(totals.unpaid)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-bold text-t3">{label}</p>
            <p className="mt-2 text-xl font-extrabold text-t1 num">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold text-t2">
            {buildingFilter
              ? `${buildings.find((building) => building.id === Number(buildingFilter))?.name ?? "선택 건물"} ${toMonthInput(period)}`
              : `전체 건물 ${toMonthInput(period)}`} 항목별 부과
          </span>
          {feeItems.length > 0 ? feeItems.map(([name, amount]) => (
            <span key={name} className="rounded-full bg-blue-t2 px-2.5 py-1 text-xs font-bold text-blue">
              {name} {formatCurrency(amount)}
            </span>
          )) : (
            <span className="text-xs text-t4">확정된 항목별 부과가 없습니다.</span>
          )}
        </div>
      </div>

      {isBuildingsLoading || isLoading ? (
        <Spinner />
      ) : isError ? (
        <div className="rounded-2xl border border-red/20 bg-red-t p-8 text-center">
          <p className="text-sm font-semibold text-red">수납현황을 불러오지 못했습니다. 다시 시도해 주세요.</p>
          <Button type="button" variant="ghost" className="mt-4" onClick={() => void refetch()}>
            다시 시도
          </Button>
        </div>
      ) : filteredRows.length === 0 ? (
        <EmptyState message="조건에 맞는 데이터가 없습니다" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[1480px] text-sm">
            <thead>
              <tr className="border-b border-line bg-bg text-left text-xs font-bold text-t3">
                <th className="px-3 py-3">건물명</th>
                <th className="px-3 py-3">호실명</th>
                <th className="px-3 py-3">입주자명</th>
                <th className="px-3 py-3 text-right">부과금액</th>
                <th className="px-3 py-3 text-right">수납금액</th>
                <th className="px-3 py-3 text-right">미납금액</th>
                <th className="px-3 py-3">납기일</th>
                <th className="px-3 py-3">수납상태</th>
                <th className="px-3 py-3">행 액션</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={`${row.buildingId}:${row.unitId}`} className="border-b border-line last:border-0">
                  <td className="px-3 py-4 font-bold text-t1">{row.buildingName}</td>
                  <td className="px-3 py-4 text-t2">{unitLabel(row)}</td>
                  <td className="px-3 py-4 text-t2">{row.tenantName ?? (row.isVacant ? "공실" : "-")}</td>
                  <td className="px-3 py-4 text-right font-semibold text-t1 num">{formatCurrency(row.charged)}</td>
                  <td className="px-3 py-4 text-right text-t2 num">{formatCurrency(row.paid)}</td>
                  <td className="px-3 py-4 text-right font-bold text-red num">{formatCurrency(row.unpaid)}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-t2">{formatDate(row.dueDate)}</td>
                  <td className="px-3 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[row.payStatus]}`}>
                      {STATUS_OPTIONS.find((option) => option.value === row.payStatus)?.label}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-blue hover:bg-blue-t2"
                        onClick={() => openBillMessage(row)}
                      >
                        고지서 문자 전송
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-t2 hover:bg-bg"
                        onClick={() => router.push(paymentDeepLink(row, period, "history"))}
                      >
                        미납·수납내역
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-t2 hover:bg-bg"
                        onClick={() => router.push(paymentDeepLink(row, period, "statement"))}
                      >
                        수납명세서 출력
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-t2 hover:bg-bg"
                        onClick={() => router.push(paymentDeepLink(row, period, "receipt"))}
                      >
                        영수증 출력
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {messagingPreset && (
        <MessagingModal
          open
          preset={messagingPreset}
          onClose={() => setMessagingPreset(null)}
          onSent={(result) => {
            toast.success(`문자가 발송되었습니다. (성공 ${result.count}건)`);
            setMessagingPreset(null);
          }}
        />
      )}
    </section>
  );
}
