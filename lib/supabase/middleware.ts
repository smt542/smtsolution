import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_SCOPE_HEADER, authCookieName, type AuthScope } from "@/lib/supabase/authScope";

/**
 * proxy 에서 이 영역(scope) 쿠키로 세션을 갱신하고, 서버 컴포넌트가 같은 영역 쿠키를 읽도록
 * 요청 헤더 `x-auth-scope` 를 주입한다(클라이언트가 보낸 값은 덮어쓴다).
 */
export async function updateSession(request: NextRequest, scope: AuthScope) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(AUTH_SCOPE_HEADER, scope);
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });
  let response = next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: authCookieName(scope) },
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // request.cookies.set 이 바꾼 Cookie 헤더를 다음 단계 요청 헤더에도 반영한다.
          const cookieHeader = request.headers.get("cookie");
          if (cookieHeader !== null) requestHeaders.set("cookie", cookieHeader);
          response = next();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  return { response, user };
}
