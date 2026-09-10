import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/staff/login";
  const isStaff = pathname.startsWith("/staff");
  const isPlatformAdmin = pathname.startsWith("/platform-admin");
  const isPlatformAdminLogin = pathname === "/platform-admin/login";
  const isPartner = pathname.startsWith("/partner");
  const isPartnerLogin = pathname === "/partner/mobile-login";
  const isResident = pathname.startsWith("/resident");
  const isResidentLogin = pathname === "/resident/login";
  // 법적 고지 페이지는 로그인 전에도 열람 가능해야 한다(로그인 하단 약관·처리방침
  // 링크, 카카오 로그인 심사의 개인정보 처리방침 URL 접근). 정적 컨텐츠라 PII 없음.
  const isResidentPublic =
    isResidentLogin ||
    pathname === "/resident/privacy" ||
    pathname === "/resident/terms";

  if ((isStaff && !isLogin) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/staff/login";
    return NextResponse.redirect(url);
  }
  if (isPlatformAdmin && !isPlatformAdminLogin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/platform-admin/login";
    return NextResponse.redirect(url);
  }
  if (isPlatformAdminLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/platform-admin";
    return NextResponse.redirect(url);
  }
  if (isPartner && !isPartnerLogin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/partner/mobile-login";
    return NextResponse.redirect(url);
  }
  // 인증 상태로 파트너 로그인 진입 시 홈으로. 비-field 계정은 홈의 (app) 가드가
  // /staff로 되돌리므로(로그인 화면이 아님) 리다이렉트 루프가 생기지 않는다.
  if (isPartnerLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/partner/mobile-home";
    return NextResponse.redirect(url);
  }
  // 세입자앱 서버측 가드(클라 useResidentGuard와 동일 정책의 심층방어).
  // /resident/login·/resident/privacy·/resident/terms만 공개. 공개 토큰
  // 상세(/r/*)는 이 matcher 밖이라 영향 없음.
  if (isResident && !isResidentPublic && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/resident/login";
    return NextResponse.redirect(url);
  }
  if (isLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/staff/receipts";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/staff/:path*", "/platform-admin/:path*", "/partner/:path*", "/resident/:path*"],
};
