"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { shouldSignOutOnBoot, LEGACY_AUTO_LOGIN_KEY, SESSION_ALIVE_KEY } from "@/lib/auth/sessionPersistence";

export function AuthBoot() {
  useEffect(() => {
    // 자동 로그인은 아이디 기억만 한다(정책 2026-08-12). 과거 영구 세션 플래그가 남아 있으면 지운다.
    try { localStorage.removeItem(LEGACY_AUTO_LOGIN_KEY); } catch {}
    // 표식을 탭마다 따로인 sessionStorage에 두면 새 탭을 브라우저 재시작으로 오판한다. 쿠키로 옮기기 전부터 열려 있던 탭은 sessionStorage 표식도 본다.
    const sessionAlive =
      document.cookie.split("; ").includes(`${SESSION_ALIVE_KEY}=1`) ||
      sessionStorage.getItem(SESSION_ALIVE_KEY) === "1";
    if (shouldSignOutOnBoot(sessionAlive)) {
      // 기본 범위(global)는 같은 계정의 다른 PC·브라우저 세션까지 끊으므로 이 브라우저 세션만 끝낸다.
      void createClient().auth.signOut({ scope: "local" }).catch(() => {});
    }
    document.cookie = `${SESSION_ALIVE_KEY}=1; path=/; samesite=lax`;
  }, []);
  return null;
}
