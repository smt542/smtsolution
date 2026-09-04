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
  const name = profile && typeof profile.nickname === "string"
    ? profile.nickname.trim() || null
    : null;
  const rawPhone = account && typeof account.phone_number === "string"
    ? account.phone_number
    : null;
  const phone = rawPhone ? normalizePhone(rawPhone) || null : null;

  const response = NextResponse.redirect(new URL("/resident/auth", request.url));
  clearStateCookie(response);

  try {
    const session = await mintResidentSession({
      kakaoId: String(rawId),
      name,
      phone,
    });
    session.applyTo(response);
  } catch {
    return errorResponse("Unable to establish the resident session.", 500);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
