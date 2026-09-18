"use client";

import type { ReactNode } from "react";
import { useMe } from "@/hooks/reactquery/auth";
import { hasModule, type ModuleKey } from "@/lib/auth/permissions";
import { EmptyState } from "./EmptyState";

/**
 * 모듈 권한이 없는 직원에게 안내 화면을 보여주는 논블로킹 게이트.
 *
 * 컨텍스트(`["auth","me"]`)가 도착하기 전에는 children을 그대로 그린다 — 여기서 기다리면
 * 진입 로더가 되살아나기 때문이다. 이 쿼리는 셸(Sidebar·AccountActiveGuard)이 이미
 * 구독하고 있어 화면 진입 시점엔 대개 캐시 히트이고, 추가 네트워크는 발생하지 않는다.
 *
 * 실제 차단은 서버가 한다 — 레이아웃의 `requirePersona`가 비직원을 막고, 각 API가
 * `hasModule`로 403을 반환한다. 이 컴포넌트는 표시를 정정할 뿐 보안 경계가 아니다.
 */
export function ModuleGate({
  module,
  message,
  children,
}: {
  module: ModuleKey;
  message: string;
  children: ReactNode;
}) {
  const { data: me } = useMe();

  if (me !== undefined && !hasModule(me, module)) {
    return (
      <div className="p-6">
        <EmptyState message={message} />
      </div>
    );
  }

  return <>{children}</>;
}
