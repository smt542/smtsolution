"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SESSION_SWITCHED_ERROR } from "@/lib/auth/sessionSwitched";

type WorkforcePersona = "manager_staff" | "field_partner" | "platform_admin";

/** lib/auth/requirePersona 의 서버 술어와 같은 RPC(서버 전용 모듈이라 여기서 다시 적는다). */
const PREDICATE: Record<WorkforcePersona, string> = {
  manager_staff: "current_user_is_manager_staff",
  field_partner: "current_user_is_field_partner",
  platform_admin: "current_user_is_platform_admin",
};

/**
 * 열려 있는 화면의 세션이 이 영역 역할인지 화면 이동·탭 복귀 때 다시 확인한다.
 * 같은 브라우저 다른 탭에서 다른 역할로 로그인하면 쿠키가 바뀌는데, 레이아웃 서버 게이트는 화면 간 이동에서
 * 다시 돌지 않아 각 화면의 「권한이 없습니다」가 떴다. 역할이 없으면 switch-entry 로 세션을 끊고
 * 로그인 화면(재로그인 안내)으로 보낸다. 조회 실패는 로그아웃 사유가 아니다.
 */
export function EntryPersonaWatcher({ persona }: { persona: WorkforcePersona }) {
  const pathname = usePathname();
  const redirecting = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (redirecting.current) return;
      const sb = createClient();
      const { data: { user }, error: userError } = await sb.auth.getUser();
      if (cancelled || userError) return;
      let allowed = false;
      if (user) {
        const { data, error } = await sb.rpc(PREDICATE[persona]);
        if (cancelled || error) return;
        allowed = data === true;
      }
      if (allowed) return;
      redirecting.current = true;
      // 라우트 핸들러가 쿠키를 지우고 로그인으로 보내므로 전체 이동한다.
      window.location.replace(`/api/auth/switch-entry?to=${persona}&reason=${SESSION_SWITCHED_ERROR}`);
    };
    void check();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [pathname, persona]);

  return null;
}
