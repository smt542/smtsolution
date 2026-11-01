import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import {
  AUTH_SCOPE_HEADER,
  DEFAULT_AUTH_SCOPE,
  authCookieName,
  parseAuthScope,
  type AuthScope,
} from "@/lib/supabase/authScope";

/**
 * 서버 Supabase 클라이언트. 인증 쿠키는 영역별로 나뉜다(QA #59).
 * 영역 결정 순서: 인자 `scope` → 요청 헤더 `x-auth-scope`(화면은 proxy 가 경로 기준으로 주입,
 * 공용 API 는 호출부가 전송) → 기본 영역(staff).
 */
export async function createClient(setAllCookies?: SetAllCookies, scope?: AuthScope) {
  const cookieStore = await cookies();
  const resolvedScope =
    scope ?? parseAuthScope((await headers()).get(AUTH_SCOPE_HEADER)) ?? DEFAULT_AUTH_SCOPE;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: authCookieName(resolvedScope) },
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet, headers) {
          if (setAllCookies) {
            return setAllCookies(cookiesToSet, headers);
          }

          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options));
          } catch { /* Server Component에서 set 호출 시 무시 (middleware가 갱신) */ }
        },
      },
    },
  );
}
