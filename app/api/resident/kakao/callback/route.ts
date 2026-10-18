import { type NextRequest, NextResponse } from "next/server";

import { normalizePhone } from "@/lib/format";
import { ORG_SUSPENDED_ERROR } from "@/lib/auth/orgSuspended";
import { mintResidentSession, ResidentOrgSuspendedError } from "@/lib/resident/session";

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

function errorRedirect(request: NextRequest, code: string) {
  const configuredRedirect = process.env.KAKAO_REDIRECT_URI;
  const origin = configuredRedirect
    ? new URL(configuredRedirect).origin
    : request.nextUrl.origin;
  const url = new URL("/resident/login", origin);
  url.searchParams.set("error", code);
  const response = NextResponse.redirect(url);
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
    return errorRedirect(request, "provider_unavailable");
  }

  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  if (!state || !expectedState || state !== expectedState) {
    return errorRedirect(request, "invalid_state");
  }

  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    return errorRedirect(request, "cancelled");
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return errorRedirect(request, "missing_code");
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
    return errorRedirect(request, "provider_unavailable");
  }

  const tokenPayload: unknown = await tokenResponse.json().catch(() => null);
  const accessToken = isRecord(tokenPayload) && typeof tokenPayload.access_token === "string"
    ? tokenPayload.access_token
    : null;
  if (!tokenResponse.ok || !accessToken) {
    return errorRedirect(request, "provider_unavailable");
  }

  let userResponse: Response;
  try {
    userResponse = await fetch(KAKAO_USER_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return errorRedirect(request, "provider_unavailable");
  }

  const userPayload: unknown = await userResponse.json().catch(() => null);
  if (!userResponse.ok || !isRecord(userPayload)) {
    return errorRedirect(request, "provider_unavailable");
  }

  const rawId = userPayload.id;
  if ((typeof rawId !== "number" && typeof rawId !== "string") || String(rawId) === "") {
    return errorRedirect(request, "provider_unavailable");
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
  // 카카오 썸네일이 http://로 올 수 있어 https로 정규화(프로덕션 https에서 mixed-content 차단 방지).
  const profileImage = profile && typeof profile.thumbnail_image_url === "string"
    ? profile.thumbnail_image_url.trim().replace(/^http:\/\//i, "https://") || null
    : null;

  // Amplify(SSR)에서 request.url은 내부 호스트(localhost:3000)라 그대로 쓰면 카카오 인증 후
  // 사용자가 localhost로 튕긴다(ERR_SSL_PROTOCOL_ERROR). 카카오가 방금 브라우저를 보낸
  // redirectUri의 origin이 곧 공개 도메인이므로 이를 기준으로 로그인 후 목적지를 만든다.
  const publicOrigin = new URL(redirectUri).origin;
  try {
    const session = await mintResidentSession({
      kakaoId: String(rawId),
      name,
      phone,
      profileImage,
    });
    const response = NextResponse.redirect(new URL(session.destination, publicOrigin));
    clearStateCookie(response);
    session.applyTo(response);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof ResidentOrgSuspendedError) {
      return errorRedirect(request, ORG_SUSPENDED_ERROR);
    }
    return errorRedirect(request, "session_failed");
  }
}
