"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";
import { Button, DataTable, EmptyState, Input, Select, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  useSettlementInquiry,
  type SettlementInquiryType,
  type SettlementStatus,
} from "@/hooks/reactquery/movingSettlement";
import { SETTLEMENT_INQUIRY_TYPES } from "@/hooks/reactquery/movingSettlement/inquiryTypes";
import { hasModule } from "@/lib/auth/permissions";

const TYPE_LABELS: Record<SettlementInquiryType, string> = {
  water: "수도",
  electric: "전기",
  gas: "가스",
  all: "전체",
};

const STATUS_LABELS: Record<SettlementStatus, string> = {
  draft: "작성 중",
  saved: "저장",
  mid_moveout: "중도퇴실",
  completed: "정산완료",
};

type FilterStatus = "" | SettlementStatus;

interface FilterState {
  buildingId: string;
  from: string;
  to: string;
  search: string;
  status: FilterStatus;
}

function currentMonthRange(): Pick<FilterState, "from" | "to"> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    from: `${year}-${pad(month + 1)}-01`,
    to: `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`,
  };
}

function money(value: number | null): string {
  return value === null ? "-" : `${value.toLocaleString("ko-KR")}원`;
}

function inquiryColumns(type: SettlementInquiryType) {
  const columns = [
    { key: "moveOutDate", label: "퇴실일" },
    { key: "building", label: "건물" },
    { key: "unit", label: "호실" },
    { key: "tenant", label: "입주자" },
  ];
  if (type === "water" || type === "all") columns.push({ key: "water", label: "수도요금" });
  if (type === "electric" || type === "all") columns.push({ key: "electric", label: "전기요금" });
  if (type === "gas" || type === "all") columns.push({ key: "gas", label: "가스요금" });
  columns.push(
    { key: "total", label: "정산 합계" },
    { key: "status", label: "상태" },
  );
  return columns;
}

export function SettlementInquiryPage({ type }: { type: SettlementInquiryType }) {
  const range = currentMonthRange();
  const initialFilters: FilterState = {
    buildingId: "",
    from: range.from,
    to: range.to,
    search: "",
    status: "",
  };
  const { data: me } = useMe();
  const buildingsQuery = useBuildings();
  const [draft, setDraft] = useState<FilterState>(initialFilters);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const inquiryQuery = useSettlementInquiry({
    type,
    buildingId: filters.buildingId ? Number(filters.buildingId) : undefined,
    from: filters.from,
    to: filters.to,
    search: filters.search || undefined,
    status: filters.status || undefined,
    page,
    pageSize,
  });

  if (me === undefined) return null;
  if (!hasModule(me, "moving")) {
    return (
      <div className="p-6">
        <EmptyState message="이 화면에 접근할 권한이 없습니다. (이사정산 권한 필요)" />
      </div>
    );
  }

  const total = inquiryQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const invalidRange = filters.from > filters.to;
  const rows: Record<string, ReactNode>[] = (inquiryQuery.data?.rows ?? []).map((row) => ({
    moveOutDate: row.moveOutDate ?? "-",
    building: row.buildingName,
    unit: [row.dong, row.unitNo].filter(Boolean).join(" "),
    tenant: row.tenantName ?? "-",
    water: money(row.waterCharge),
    electric: money(row.elecCharge),
    gas: money(row.gasCharge),
    total: money(row.settlementAmount),
    status: (
      <span className="inline-flex rounded-full bg-blue-t px-2.5 py-1 text-xs font-bold text-blue-d">
        {STATUS_LABELS[row.status]}
      </span>
    ),
  }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters(draft);
    setPage(1);
  };

  return (
    <div className="flex min-h-screen flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-t3">관리업무 · 이사정산 · 조회</p>
          <h1 className="mt-1 text-2xl font-extrabold text-t1">
            {TYPE_LABELS[type]} 이사조회
          </h1>
        </div>
        <Link
          href="/staff/moving-settlement"
          className="inline-flex h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-t2 hover:bg-bg"
        >
          정산 입력
        </Link>
      </div>

      <nav aria-label="이사조회 유형" className="flex flex-wrap gap-2">
        {SETTLEMENT_INQUIRY_TYPES.map((item) => (
          <Link
            key={item}
            href={`/staff/moving-settlement/inquiries/${item}`}
            aria-current={item === type ? "page" : undefined}
            className={`inline-flex h-10 items-center rounded-xl px-4 text-sm font-bold ${
              item === type
                ? "bg-brand text-white shadow-pri"
                : "border border-line bg-white text-t2 hover:bg-bg"
            }`}
          >
            {TYPE_LABELS[item]}
          </Link>
        ))}
      </nav>

      <form
        onSubmit={submit}
        className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1.4fr_1fr_auto]"
      >
        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">건물</span>
          <Select
            aria-label="건물"
            value={draft.buildingId}
            disabled={buildingsQuery.isLoading}
            onChange={(event) => setDraft((current) => ({ ...current, buildingId: event.target.value }))}
            options={[
              { value: "", label: buildingsQuery.isLoading ? "건물 불러오는 중" : "전체 건물" },
              ...(buildingsQuery.data ?? []).map((building) => ({
                value: String(building.id),
                label: building.name,
              })),
            ]}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">시작일</span>
          <Input
            aria-label="조회 시작일"
            type="date"
            value={draft.from}
            onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">종료일</span>
          <Input
            aria-label="조회 종료일"
            type="date"
            value={draft.to}
            onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">검색</span>
          <Input
            aria-label="검색어"
            value={draft.search}
            placeholder="건물·동·호실·입주자"
            onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">상태</span>
          <Select
            aria-label="상태"
            value={draft.status}
            onChange={(event) => setDraft((current) => ({
              ...current,
              status: event.target.value as FilterStatus,
            }))}
            options={[
              { value: "", label: "전체 상태" },
              { value: "draft", label: STATUS_LABELS.draft },
              { value: "saved", label: STATUS_LABELS.saved },
              { value: "mid_moveout", label: STATUS_LABELS.mid_moveout },
              { value: "completed", label: STATUS_LABELS.completed },
            ]}
          />
        </label>
        <Button type="submit" className="self-end">조회</Button>
      </form>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-extrabold text-t1">조회 결과</h2>
          <span className="text-sm font-bold text-t3">총 {total.toLocaleString("ko-KR")}건</span>
        </div>

        {invalidRange ? (
          <EmptyState message="조회 시작일은 종료일보다 늦을 수 없습니다." />
        ) : inquiryQuery.isLoading ? (
          <div className="py-16"><Spinner /></div>
        ) : inquiryQuery.error ? (
          <EmptyState message="이사정산 조회 결과를 불러오지 못했습니다." />
        ) : rows.length === 0 ? (
          <EmptyState message="조건에 맞는 이사정산 내역이 없습니다." />
        ) : (
          <>
            <DataTable columns={inquiryColumns(type)} rows={rows} />
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                이전
              </Button>
              <span className="min-w-20 text-center text-sm font-bold text-t3">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                다음
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
