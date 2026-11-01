"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { shouldSignOutOnBoot, LEGACY_AUTO_LOGIN_KEY, sessionAliveKey } from "@/lib/auth/sessionPersistence";
import type { AuthScope } from "@/lib/supabase/authScope";

/**
 * 브라우저를 닫았다 다시 연 경우 이 영역(scope) 세션만 끝낸다(QA #59 영역별 세션 분리).
 * 표식도 영역별이라, 다른 영역에서 먼저 로그인한 세션(예: 현장)은 건드리지 않는다.
 */
export function AuthBoot({ scope }: { scope: AuthScope }) {
  useEffect(() => {
    // 자동 로그인은 아이디 기억만 한다(정책 2026-08-12). 과거 영구 세션 플래그가 남아 있으면 지운다.
    try { localStorage.removeItem(LEGACY_AUTO_LOGIN_KEY); } catch {}
    // 표식을 탭마다 따로인 sessionStorage에 두면 새 탭을 브라우저 재시작으로 오판하므로 만료일 없는 쿠키(탭 공유)를 쓴다.
    const aliveKey = sessionAliveKey(scope);
    const sessionAlive = document.cookie.split("; ").includes(`${aliveKey}=1`);
    if (shouldSignOutOnBoot(sessionAlive)) {
      // 기본 범위(global)는 같은 계정의 다른 PC·브라우저 세션까지 끊으므로 이 브라우저 세션만 끝낸다.
      void createClient(scope).auth.signOut({ scope: "local" }).catch(() => {});
    }
    document.cookie = `${aliveKey}=1; path=/; samesite=lax`;
  }, [scope]);
  return null;
}
