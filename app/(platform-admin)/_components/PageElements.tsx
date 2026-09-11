"use client";

import { Badge, IconButton } from "@/components/common";
import { formatNumber } from "@/lib/format";

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header>
      <div className="text-xs font-extrabold tracking-[0.12em] text-blue">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-t1 sm:text-[28px]">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-t3">{description}</p>
    </header>
  );
}

export function DataScopeNotice() {
  return (
    <div className="flex gap-2.5 rounded-2xl border border-[#CFE0FC] bg-blue-t2 px-4 py-3 text-xs leading-5 text-[#3569A8]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
      </svg>
      <p><code className="font-bold">platform_admin</code> 권한으로 전체 관리회사(테넌트) 데이터를 조회·관리합니다.</p>
    </div>
  );
}

export function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red/20 bg-red-t px-5 py-8 text-center">
      <p className="text-sm font-bold text-red">데이터를 불러오지 못했습니다.</p>
      <button type="button" onClick={onRetry} className="mt-3 rounded-xl border border-red/20 bg-white px-3 py-2 text-xs font-bold text-red">
        다시 시도
      </button>
    </div>
  );
}

export function StatusBadge({ status }: { status: "active" | "suspended" | "trial" }) {
  const styles = {
    active: { label: "운영 중", className: "bg-blue-t text-blue-d" },
    suspended: { label: "정지", className: "bg-red-t text-red" },
    trial: { label: "체험", className: "bg-amber-t text-amber" },
  }[status];
  return <Badge className={`inline-flex px-[9px] py-[3px] leading-[1.4] ${styles.className}`}>{styles.label}</Badge>;
}

function shiftMonth(iso: string, delta: number): string {
  const [year, month] = iso.split("-").map(Number);
  const shifted = new Date(year, month - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-01`;
}

function currentMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthLabel(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  return `${year}년 ${month}월`;
}

export function BoundedMonthStepper({
  month,
  onChange,
  minYear = 2025,
}: {
  month: string;
  onChange: (month: string) => void;
  minYear?: number;
}) {
  const minMonth = `${minYear}-01-01`;
  const maxMonth = currentMonthIso();
  const previousDisabled = month <= minMonth;
  const nextDisabled = month >= maxMonth;

  return (
    <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
      <IconButton
        aria-label="이전 달"
        onClick={() => onChange(shiftMonth(month, -1))}
        disabled={previousDisabled}
        className="h-8 w-8 rounded-lg text-t3 hover:bg-bg hover:text-t1 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-t3"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </IconButton>
      <span className="min-w-[92px] text-center text-sm font-extrabold text-t1">
        {monthLabel(month)}
      </span>
      <IconButton
        aria-label="다음 달"
        onClick={() => onChange(shiftMonth(month, 1))}
        disabled={nextDisabled}
        className="h-8 w-8 rounded-lg text-t3 hover:bg-bg hover:text-t1 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-t3"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </IconButton>
    </div>
  );
}

type PaginationItem = number | "start-ellipsis" | "end-ellipsis";

function paginationItems(page: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (page <= 4) return [1, 2, 3, 4, 5, "end-ellipsis", totalPages];
  if (page >= totalPages - 3) {
    return [1, "start-ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "start-ellipsis", page - 1, page, page + 1, "end-ellipsis", totalPages];
}

export function PlatformPagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  numeric = false,
  compact = false,
  totalLabel,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  numeric?: boolean;
  compact?: boolean;
  totalLabel?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (totalPages <= 1 && !totalLabel) return null;
  const directionButtonClassName = compact
    ? "flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-[12.5px] font-bold text-t3 hover:bg-bg disabled:cursor-not-allowed disabled:text-t4"
    : "rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-t2 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className={`relative flex items-center border-t ${compact ? "gap-1 border-line2 px-[14px] py-[11px]" : "gap-3 border-line px-4 py-3"} ${totalLabel && !compact ? "justify-between" : "justify-center"}`}>
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          aria-label="이전 페이지"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={directionButtonClassName}
        >
          {compact ? "‹" : "이전"}
        </button>
        {numeric ? paginationItems(page, totalPages).map((item) => (
          typeof item === "number" ? (
            <button
              key={item}
              type="button"
              aria-current={item === page ? "page" : undefined}
              onClick={() => onPageChange(item)}
              className={`${compact ? "h-7 min-w-7 text-[12.5px]" : "h-8 min-w-8 text-xs"} rounded-lg px-2 font-bold ${
                item === page ? "bg-blue text-white" : "text-t3 hover:bg-bg hover:text-t1"
              }`}
            >
              {formatNumber(item)}
            </button>
          ) : (
            <span key={item} className="px-1 text-xs text-t4" aria-hidden="true">…</span>
          )
        )) : (
          <span className="px-2 text-xs font-semibold text-t3 num">
            {formatNumber(page)} / {formatNumber(totalPages)}
          </span>
        )}
        <button
          type="button"
          aria-label="다음 페이지"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={directionButtonClassName}
        >
          {compact ? "›" : "다음"}
        </button>
      </div>
      {totalLabel && (
        <span className={`${compact ? "absolute right-[14px] hidden text-t4 sm:inline" : "text-t3"} text-xs font-semibold num`}>
          {totalLabel}
        </span>
      )}
    </div>
  );
}

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-6 lg:p-8">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <section className="mt-7 flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-[#CBD5E1] bg-white/70 p-8 text-center">
        <div className="max-w-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-t text-blue">{icon}</div>
          <h3 className="mt-5 text-lg font-extrabold text-t1">연동 준비 중</h3>
          <p className="mt-2 text-sm leading-6 text-t3">필요한 데이터 스키마가 확정되면 실제 현황과 관리 기능을 연결합니다.</p>
          <Badge tone="gray" className="mt-5 inline-flex px-3 py-1.5">데이터 미연동</Badge>
        </div>
      </section>
    </div>
  );
}
