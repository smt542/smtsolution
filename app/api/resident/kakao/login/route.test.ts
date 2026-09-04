import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { GET } from "./route";

const originalClientId = process.env.KAKAO_REST_API_KEY;
const originalRedirectUri = process.env.KAKAO_REDIRECT_URI;

beforeEach(() => {
  process.env.KAKAO_REST_API_KEY = "kakao-rest-key";
  process.env.KAKAO_REDIRECT_URI = "http://localhost/api/resident/kakao/callback";
});

afterAll(() => {
  if (originalClientId === undefined) delete process.env.KAKAO_REST_API_KEY;
  else process.env.KAKAO_REST_API_KEY = originalClientId;

  if (originalRedirectUri === undefined) delete process.env.KAKAO_REDIRECT_URI;
  else process.env.KAKAO_REDIRECT_URI = originalRedirectUri;
});

describe("GET /api/resident/kakao/login", () => {
  it("redirects to Kakao with a matching httpOnly state cookie", async () => {
    const response = await GET();

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    const state = location.searchParams.get("state");
    expect(location.origin + location.pathname).toBe(
      "https://kauth.kakao.com/oauth/authorize",
    );
    expect(location.searchParams.get("client_id")).toBe("kakao-rest-key");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "http://localhost/api/resident/kakao/callback",
    );
    expect(location.searchParams.get("response_type")).toBe("code");
    expect(location.searchParams.get("scope")).toBe(
      "profile_nickname,phone_number",
    );
    expect(state).toMatch(/^[a-f0-9]{32}$/);

    expect(response.cookies.get("resident_kakao_oauth_state")).toEqual(
      expect.objectContaining({ value: state }),
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain(
      "Path=/api/resident/kakao/callback",
    );
  });

  it("returns 404 when real Kakao OAuth is not configured", async () => {
    delete process.env.KAKAO_REST_API_KEY;

    const response = await GET();

    expect(response.status).toBe(404);
  });
});
