import { NextRequest, type NextResponse } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  mintResidentSession: vi.fn(),
  applyTo: vi.fn((response: NextResponse) => {
    response.cookies.set("sb-test-auth-token", "resident-session", {
      httpOnly: true,
      path: "/",
    });
    response.headers.set("x-resident-session", "attached");
  }),
}));

vi.mock("@/lib/resident/session", () => ({
  mintResidentSession: mocks.mintResidentSession,
}));

import { GET } from "./route";

const originalEnv = {
  clientId: process.env.KAKAO_REST_API_KEY,
  clientSecret: process.env.KAKAO_CLIENT_SECRET,
  redirectUri: process.env.KAKAO_REDIRECT_URI,
};

function request(query: string, stateCookie = "csrf-state") {
  return new NextRequest(`http://localhost/api/resident/kakao/callback?${query}`, {
    headers: { Cookie: `resident_kakao_oauth_state=${stateCookie}` },
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  process.env.KAKAO_REST_API_KEY = "kakao-rest-key";
  process.env.KAKAO_CLIENT_SECRET = "kakao-client-secret";
  process.env.KAKAO_REDIRECT_URI = "http://localhost/api/resident/kakao/callback";

  mocks.fetch
    .mockResolvedValueOnce(jsonResponse({ access_token: "kakao-access-token" }))
    .mockResolvedValueOnce(jsonResponse({
      id: 123456,
      kakao_account: {
        profile: { nickname: "Kakao Resident" },
        phone_number: "+82 10-1234-5678",
      },
    }));
  mocks.mintResidentSession.mockResolvedValue({
    userId: "resident-1",
    kakaoId: "123456",
    name: "Kakao Resident",
    phone: "01012345678",
    applyTo: mocks.applyTo,
  });
});

afterAll(() => {
  vi.unstubAllGlobals();

  if (originalEnv.clientId === undefined) delete process.env.KAKAO_REST_API_KEY;
  else process.env.KAKAO_REST_API_KEY = originalEnv.clientId;
  if (originalEnv.clientSecret === undefined) delete process.env.KAKAO_CLIENT_SECRET;
  else process.env.KAKAO_CLIENT_SECRET = originalEnv.clientSecret;
  if (originalEnv.redirectUri === undefined) delete process.env.KAKAO_REDIRECT_URI;
  else process.env.KAKAO_REDIRECT_URI = originalEnv.redirectUri;
});

describe("GET /api/resident/kakao/callback", () => {
  it("exchanges the code, normalizes the Kakao phone, and redirects with the session", async () => {
    const response = await GET(request("code=oauth-code&state=csrf-state"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/resident/auth");
    expect(mocks.fetch).toHaveBeenNthCalledWith(
      1,
      "https://kauth.kakao.com/oauth/token",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
    const tokenRequest = mocks.fetch.mock.calls[0][1];
    expect(String(tokenRequest.body)).toContain("grant_type=authorization_code");
    expect(String(tokenRequest.body)).toContain("client_secret=kakao-client-secret");
    expect(mocks.fetch).toHaveBeenNthCalledWith(
      2,
      "https://kapi.kakao.com/v2/user/me",
      expect.objectContaining({
        headers: { Authorization: "Bearer kakao-access-token" },
        cache: "no-store",
      }),
    );
    expect(mocks.mintResidentSession).toHaveBeenCalledWith({
      kakaoId: "123456",
      name: "Kakao Resident",
      phone: "01012345678",
    });
    expect(mocks.applyTo).toHaveBeenCalledWith(response);
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe(
      "resident-session",
    );
    expect(response.headers.get("x-resident-session")).toBe("attached");
    expect(response.cookies.get("resident_kakao_oauth_state")?.value).toBe("");
  });

  it("allows Kakao login without phone consent", async () => {
    mocks.fetch.mockReset();
    mocks.fetch
      .mockResolvedValueOnce(jsonResponse({ access_token: "kakao-access-token" }))
      .mockResolvedValueOnce(jsonResponse({
        id: "resident-without-phone",
        kakao_account: { profile: { nickname: "No Phone" } },
      }));

    const response = await GET(request("code=oauth-code&state=csrf-state"));

    expect(response.status).toBe(307);
    expect(mocks.mintResidentSession).toHaveBeenCalledWith({
      kakaoId: "resident-without-phone",
      name: "No Phone",
      phone: null,
    });
  });

  it("rejects a callback whose state does not match the cookie", async () => {
    const response = await GET(request("code=oauth-code&state=wrong-state"));

    expect(response.status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.mintResidentSession).not.toHaveBeenCalled();
  });

  it("returns 404 when real Kakao OAuth is not configured", async () => {
    delete process.env.KAKAO_REST_API_KEY;

    const response = await GET(request("code=oauth-code&state=csrf-state"));

    expect(response.status).toBe(404);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
