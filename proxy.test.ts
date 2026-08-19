import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";

const { updateSession } = vi.hoisted(() => ({ updateSession: vi.fn() }));
vi.mock("@/lib/supabase/middleware", () => ({ updateSession }));

import { config, proxy } from "./proxy";

function request(pathname: string) {
  return new NextRequest(`https://example.com${pathname}`);
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("staff와 platform-admin 경로에만 매칭된다", () => {
    expect(
      unstable_doesMiddlewareMatch({ config, url: "https://example.com/staff" })
    ).toBe(true);
    expect(
      unstable_doesMiddlewareMatch({ config, url: "https://example.com/platform-admin/organizations" })
    ).toBe(true);
    expect(
      unstable_doesMiddlewareMatch({ config, url: "https://example.com/" })
    ).toBe(false);
  });

  it("비로그인 platform-admin 요청을 통합관리자 로그인으로 보낸다", async () => {
    updateSession.mockResolvedValue({
      response: NextResponse.next(),
      user: null,
    });

    const response = await proxy(request("/platform-admin/organizations"));

    expect(getRedirectUrl(response)).toBe("https://example.com/platform-admin/login");
  });

  it("비로그인 통합관리자 로그인 페이지 요청은 통과시킨다", async () => {
    const sessionResponse = NextResponse.next();
    updateSession.mockResolvedValue({ response: sessionResponse, user: null });

    const response = await proxy(request("/platform-admin/login"));

    expect(response).toBe(sessionResponse);
  });

  it("로그인한 사용자의 통합관리자 로그인 페이지 요청은 통합관리자 화면으로 보낸다", async () => {
    updateSession.mockResolvedValue({
      response: NextResponse.next(),
      user: { id: "platform-admin-user" },
    });

    const response = await proxy(request("/platform-admin/login"));

    expect(getRedirectUrl(response)).toBe("https://example.com/platform-admin");
  });

  it("로그인한 platform-admin 요청은 세션 응답을 그대로 반환한다", async () => {
    const sessionResponse = NextResponse.next();
    sessionResponse.headers.set("x-session-refreshed", "true");
    updateSession.mockResolvedValue({
      response: sessionResponse,
      user: { id: "platform-admin-user" },
    });

    const response = await proxy(request("/platform-admin"));

    expect(response).toBe(sessionResponse);
    expect(response.headers.get("x-session-refreshed")).toBe("true");
  });

  it("로그인한 사용자의 로그인 페이지 요청은 직원 화면으로 보낸다", async () => {
    updateSession.mockResolvedValue({
      response: NextResponse.next(),
      user: { id: "signed-in-user" },
    });

    const response = await proxy(request("/staff/login"));

    expect(getRedirectUrl(response)).toBe("https://example.com/staff");
  });
});
