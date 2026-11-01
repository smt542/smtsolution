import { createBrowserClient } from "@supabase/ssr";
import { authCookieName, currentAuthScope, type AuthScope } from "@/lib/supabase/authScope";

// 영역마다 쿠키 이름이 달라 기본 싱글톤(처음 만든 영역으로 고정됨)을 쓰지 않고 영역별로 하나씩 둔다.
const clients = new Map<AuthScope, ReturnType<typeof newClient>>();

function newClient(scope: AuthScope) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { name: authCookieName(scope) }, isSingleton: false },
  );
}

/**
 * 브라우저 Supabase 클라이언트. 영역을 생략하면 지금 열린 화면 경로로 정한다(QA #59 영역별 세션 분리).
 */
export function createClient(scope: AuthScope = currentAuthScope()) {
  const cached = clients.get(scope);
  if (cached) return cached;
  const client = newClient(scope);
  // 서버 렌더 중에는 요청 간 공유를 막기 위해 캐시하지 않는다.
  if (typeof window !== "undefined") clients.set(scope, client);
  return client;
}
