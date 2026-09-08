import { type NextRequest, NextResponse } from "next/server";

import { normalizePhone } from "@/lib/format";
import { mintResidentSession } from "@/lib/resident/session";

const KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const KAKAO_USER_URL = "https://kapi.kakao.com/v2/user/me";
const STATE_COOKIE = "resident_kakao_oauth_state";
const STATE_COOKIE_PATH = "/api/resident/kakao/callback";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clearStateCookie(response: NextResponse) {
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: STATE_COOKIE_PATH,
    maxAge: 0,
  });
}

function errorResponse(message: string, status: number) {
  const response = NextResponse.json({ error: message }, { status });
  clearStateCookie(response);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.KAKAO_REST_API_KEY;
  if (!clientId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const redirectUri = process.env.KAKAO_REDIRECT_URI;
  if (!redirectUri) {
    return errorResponse("Kakao OAuth is not configured.", 500);
  }

  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  if (!state || !expectedState || state !== expectedState) {
    return errorResponse("Invalid Kakao OAuth state.", 400);
  }

  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    return errorResponse("Kakao login was cancelled.", 400);
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return errorResponse("Missing Kakao authorization code.", 400);
  }

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
  });
  if (process.env.KAKAO_CLIENT_SECRET) {
    tokenBody.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
  }

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(KAKAO_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
      cache: "no-store",
    });
  } catch {
    return errorResponse("Unable to contact Kakao OAuth.", 502);
  }

  const tokenPayload: unknown = await tokenResponse.json().catch(() => null);
  const accessToken = isRecord(tokenPayload) && typeof tokenPayload.access_token === "string"
    ? tokenPayload.access_token
    : null;
  if (!tokenResponse.ok || !accessToken) {
    return errorResponse("Unable to exchange the Kakao authorization code.", 502);
  }

  let userResponse: Response;
  try {
    userResponse = await fetch(KAKAO_USER_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return errorResponse("Unable to contact the Kakao user API.", 502);
  }

  const userPayload: unknown = await userResponse.json().catch(() => null);
  if (!userResponse.ok || !isRecord(userPayload)) {
    return errorResponse("Unable to read the Kakao user.", 502);
  }

  const rawId = userPayload.id;
  if ((typeof rawId !== "number" && typeof rawId !== "string") || String(rawId) === "") {
    return errorResponse("Kakao user response is missing an id.", 502);
  }

  const account = isRecord(userPayload.kakao_account)
    ? userPayload.kakao_account
    : null;
  const profile = account && isRecord(account.profile) ? account.profile : null;
  // 카카오 실명(account.name)이 오면 우선 사용하고, 없으면 프로필 닉네임으로 폴백한다.
  // account.name은 이름(name) 동의항목이 심사 승인되고 scope에 추가돼야 내려오므로,
  // 그 전까지는 닉네임이 쓰인다(로그인 영향 없음).
  const realName = account && typeof account.name === "string"
    ? account.name.trim() || null
    : null;
  const nickname = profile && typeof profile.nickname === "string"
    ? profile.nickname.trim() || null
    : null;
  const name = realName ?? nickname;
  const rawPhone = account && typeof account.phone_number === "string"
    ? account.phone_number
    : null;
  const phone = rawPhone ? normalizePhone(rawPhone) || null : null;
  // 프로필 사진(선택 동의). 미동의 시 카카오가 내려주지 않으므로 null → UI는 글자 아바타.
  // 카카오 기본(회색) 이미지도 그대로 저장·표시한다(is_default_image 분기 없음).
  const profileImage = profile && typeof profile.thumbnail_image_url === "string"
    ? profile.thumbnail_image_url.trim() || null
    : null;

  const response = NextResponse.redirect(new URL("/resident/auth", request.url));
  clearStateCookie(response);

  try {
    const session = await mintResidentSession({
      kakaoId: String(rawId),
      name,
      phone,
      profileImage,
    });
    session.applyTo(response);
  } catch {
    return errorResponse("Unable to establish the resident session.", 500);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
