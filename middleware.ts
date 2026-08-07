import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/staff/login";
  const isStaff = pathname.startsWith("/staff");

  if (isStaff && !isLogin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/staff/login";
    return NextResponse.redirect(url);
  }
  if (isLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/staff/receipt-management";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ["/staff/:path*"] };
