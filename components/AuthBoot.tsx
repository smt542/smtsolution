"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { shouldSignOutOnBoot, LEGACY_AUTO_LOGIN_KEY, SESSION_ALIVE_KEY } from "@/lib/auth/sessionPersistence";
import type { AuthScope } from "@/lib/supabase/authScope";

/** 브라우저 재시작 시 끝낼 영역. 입주민(카카오) 세션은 로그인 유지 대상이라 제외한다. */
const BOOT_SIGN_OUT_SCOPES: readonly AuthScope[] = ["staff", "platform", "partner"];

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
      // 영역별 세션(QA #59): 「자동 로그인 = 아이디 기억」 정책인 업무 영역(사무실·통합관리자·현장) 세션을 모두 끝낸다.
      for (const scope of BOOT_SIGN_OUT_SCOPES) {
        void createClient(scope).auth.signOut({ scope: "local" }).catch(() => {});
      }
    }
    document.cookie = `${SESSION_ALIVE_KEY}=1; path=/; samesite=lax`;
  }, []);
  return null;
}
