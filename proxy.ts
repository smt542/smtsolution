import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/staff/login";
  const isStaff = pathname.startsWith("/staff");
  const isPlatformAdmin = pathname.startsWith("/platform-admin");
  const isPlatformAdminLogin = pathname === "/platform-admin/login";

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
  if (isLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/staff";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/staff/:path*", "/platform-admin/:path*"],
};
