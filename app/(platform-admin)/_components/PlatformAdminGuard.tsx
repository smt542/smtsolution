"use client";

import Link from "next/link";
import { Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { isMaster } from "@/lib/auth/permissions";

export function PlatformAdminGuard({ children }: { children: React.ReactNode }) {
  const { data: me, isPending, isError, refetch } = useMe();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg" aria-label="권한 확인 중">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <GuardMessage
        title="권한 정보를 확인하지 못했습니다"
        description="잠시 후 다시 시도해 주세요."
        action={(
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-xl bg-blue px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-d"
          >
            다시 시도
          </button>
        )}
      />
    );
  }

  if (!me) {
    return (
      <GuardMessage
        title="로그인이 필요합니다"
        description="직원 로그인 후 플랫폼 관리 화면에 다시 접속해 주세요."
        action={<GuardLink href="/staff/login">로그인으로 이동</GuardLink>}
      />
    );
  }

  if (!isMaster(me.role)) {
    return (
      <GuardMessage
        title="플랫폼 관리 권한이 없습니다"
        description="마스터 계정만 이 화면에 접근할 수 있습니다."
        action={<GuardLink href="/staff">직원 화면으로 돌아가기</GuardLink>}
      />
    );
  }

  return <>{children}</>;
}

function GuardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-xl bg-blue px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-d">
      {children}
    </Link>
  );
}

function GuardMessage({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <section className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-t text-blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
            <path d="M12 3 4.5 6v5.2c0 4.6 3.1 8.1 7.5 9.8 4.4-1.7 7.5-5.2 7.5-9.8V6L12 3z" />
            <path d="M9.5 12h5M12 9.5v5" />
          </svg>
        </div>
        <h1 className="mt-5 text-xl font-extrabold text-t1">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-t3">{description}</p>
        <div className="mt-6 flex justify-center">{action}</div>
      </section>
    </main>
  );
}
