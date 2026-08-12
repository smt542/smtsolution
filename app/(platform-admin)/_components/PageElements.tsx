"use client";

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
    active: { label: "운영 중", className: "bg-green-t text-green" },
    suspended: { label: "정지", className: "bg-red-t text-red" },
    trial: { label: "체험", className: "bg-amber-t text-amber" },
  }[status];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${styles.className}`}>{styles.label}</span>;
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
          <span className="mt-5 inline-flex rounded-full bg-bg px-3 py-1.5 text-xs font-bold text-t3">데이터 미연동</span>
        </div>
      </section>
    </div>
  );
}
