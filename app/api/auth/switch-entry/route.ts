import type { SetAllCookies } from "@supabase/ssr";
import { NextResponse } from "next/server";

import { ORG_SUSPENDED_ERROR } from "@/lib/auth/orgSuspended";
import { SESSION_SWITCHED_ERROR } from "@/lib/auth/sessionSwitched";
import { ENTRY_PATHS, hasEntryPersona, isEntryPersona, isOrgSuspended } from "@/lib/auth/requirePersona";
import { createClient } from "@/lib/supabase/server";

type SessionCookie = Parameters<SetAllCookies>[0][number];

// 다른 엔트리 포인트(역할 영역)로 들어온 세션을 이 브라우저에서만 끊고 그 영역 로그인 화면으로 보낸다.
// 서버 컴포넌트 게이트(requirePersona·requireResidentLink)는 쿠키를 지울 수 없어서 역할이 안 맞으면
// 이리로 보낸다. 세션을 먼저 끊어야 proxy가 로그인 화면을 앱 안으로 되돌리지 않는다.
export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const to = searchParams.get("to");
  const reason = searchParams.get("reason");
  // 표에 없는 값은 받지 않는다(임의 주소로 보내지 않음).
  if (!isEntryPersona(to)) return redirectTo("/");
  const paths = ENTRY_PATHS[to];

  // getUser가 토큰을 갱신하면 새 쿠키가 온다. 어느 응답이든 실어 보내야 갱신된 세션이 끊기지 않는다.
  const cookies: SessionCookie[] = [];
  const headers = new Headers();
  const sb = await createClient((cookiesToSet, cacheHeaders) => {
    cookies.push(...cookiesToSet);
    Object.entries(cacheHeaders).forEach(([key, value]) => headers.set(key, value));
  });
  const respond = (path: string) => redirectTo(path, cookies, headers);
  // 열려 있던 화면에서 세션이 바뀌어 보낸 경우(EntryPersonaWatcher) 로그인 화면에 재로그인 안내를 띄운다.
  const loginPath = reason === SESSION_SWITCHED_ERROR
    ? `${paths.login}?error=${SESSION_SWITCHED_ERROR}`
    : paths.login;

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return respond(loginPath);

  // 정지(계약 만료 포함) 테넌트 세션: 서버에서 다시 확인한 뒤에만 끊는다(쿼리만으로 로그아웃시키지 않음).
  if (reason === ORG_SUSPENDED_ERROR && (await isOrgSuspended(sb, to)) === true) {
    const { error } = await sb.auth.signOut({ scope: "local" });
    if (error) return respond("/");
    return respond(`${paths.login}?error=${ORG_SUSPENDED_ERROR}`);
  }

  // 이 영역 역할이 정말 없을 때만 끊는다. 역할이 있으면(링크로 들어온 정상 사용자 등) 끊지 않고 홈으로.
  const allowed = await hasEntryPersona(sb, to, user.id);
  if (allowed === null) return respond("/"); // 조회 실패는 로그아웃 사유가 아니다
  if (allowed) return respond(paths.home);

  // 계정 자체는 정상이라 이 브라우저만 끊는다(local). 다른 PC·폰 세션은 유지된다.
  const { error } = await sb.auth.signOut({ scope: "local" });
  // 실패하면 세션이 남는다. 그대로 로그인 화면으로 가면 proxy가 앱 안으로 되돌려 루프가 생기므로 중립 '/'.
  if (error) return respond("/");
  return respond(loginPath);
}

// Amplify(SSR)에서 request.url은 내부 호스트라 절대 주소를 만들지 않고 상대 Location을 쓴다.
function redirectTo(path: string, cookies: SessionCookie[] = [], headers?: Headers) {
  const response = new NextResponse(null, { status: 307, headers: { Location: path } });
  headers?.forEach((value, key) => response.headers.set(key, value));
  cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
