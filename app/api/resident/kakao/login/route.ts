import { NextResponse } from "next/server";

const KAKAO_AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize";
const STATE_COOKIE = "resident_kakao_oauth_state";
const STATE_COOKIE_PATH = "/api/resident/kakao/callback";

export async function GET() {
  const clientId = process.env.KAKAO_REST_API_KEY;
  if (!clientId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const redirectUri = process.env.KAKAO_REDIRECT_URI;
  if (!redirectUri) {
    return NextResponse.json(
      { error: "Kakao OAuth is not configured." },
      { status: 500 },
    );
  }

  const state = crypto.randomUUID().replaceAll("-", "");
  const authorizeUrl = new URL(KAKAO_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  // 카카오 이름(name) 동의항목 심사 승인 완료(필수 동의) → 실명 수신.
  // profile_image = 프로필 사진(선택 동의). 미동의 시 콜백이 URL을 못 받아 글자 아바타로 폴백.
  authorizeUrl.searchParams.set("scope", "profile_nickname,profile_image,phone_number,name");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: STATE_COOKIE_PATH,
    maxAge: 10 * 60,
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
