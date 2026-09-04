import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  identityMaybeSingle: vi.fn(),
  identityUpsert: vi.fn(),
  createUser: vi.fn(),
  getUserById: vi.fn(),
  updateUserById: vi.fn(),
  listUsers: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { POST } from "./route";

function request(body?: unknown) {
  return new Request("http://localhost/api/resident/kakao/stub", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.createAdminClient.mockReturnValue({
    auth: {
      admin: {
        createUser: mocks.createUser,
        getUserById: mocks.getUserById,
        updateUserById: mocks.updateUserById,
        listUsers: mocks.listUsers,
      },
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: mocks.identityMaybeSingle })),
      })),
      upsert: mocks.identityUpsert,
    })),
  });
  mocks.createClient.mockImplementation(async (setAllCookies?: (
    cookies: Array<{
      name: string;
      value: string;
      options: { httpOnly?: boolean; path?: string };
    }>,
    headers: Record<string, string>,
  ) => void) => ({
    auth: {
      signInWithPassword: async (input: { email: string; password: string }) => {
        const result = await mocks.signInWithPassword(input);
        setAllCookies?.(
          [{
            name: "sb-test-auth-token",
            value: "resident-session",
            options: { httpOnly: true, path: "/" },
          }],
          { "Cache-Control": "private, no-store" },
        );
        return result;
      },
    },
  }));
  mocks.identityMaybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.identityUpsert.mockResolvedValue({ error: null });
  mocks.createUser.mockResolvedValue({
    data: { user: { id: "resident-1", email: "kakao_123@resident.stub" } },
    error: null,
  });
  mocks.updateUserById.mockResolvedValue({ data: { user: {} }, error: null });
  mocks.signInWithPassword.mockResolvedValue({
    data: { session: { access_token: "token" }, user: { id: "resident-1" } },
    error: null,
  });
});

describe("POST /api/resident/kakao/stub", () => {
  it("generates a complete mock identity when the request body is absent", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: expect.stringMatching(/^kakao_stub_[a-f0-9]{32}@resident\.stub$/),
      email_confirm: true,
    }));
    expect(mocks.identityUpsert).toHaveBeenCalledWith(expect.objectContaining({
      kakao_id: expect.stringMatching(/^stub_[a-f0-9]{32}$/),
      kakao_name: "Stub Resident",
      phone: expect.stringMatching(/^010\d{8}$/),
    }), { onConflict: "user_id" });
  });

  it("creates an auth user, upserts the identity, and establishes a session", async () => {
    const response = await POST(request({
      kakaoId: "123",
      name: "Stub User",
      phone: "01012345678",
    }));

    expect(response.status).toBe(200);
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: "kakao_123@resident.stub",
      email_confirm: true,
    }));
    expect(mocks.identityUpsert).toHaveBeenCalledWith({
      user_id: "resident-1",
      kakao_id: "123",
      kakao_name: "Stub User",
      phone: "01012345678",
    }, { onConflict: "user_id" });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith(expect.objectContaining({
      email: "kakao_123@resident.stub",
    }));
    expect(await response.json()).toEqual({
      userId: "resident-1",
      kakaoId: "123",
      name: "Stub User",
      phone: "01012345678",
    });
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe(
      "resident-session",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("normalizes a Kakao-format phone before storing the identity", async () => {
    const response = await POST(request({
      kakaoId: "normalized-phone",
      name: "Stub User",
      phone: "+82 10-1234-5678",
    }));

    expect(response.status).toBe(200);
    expect(mocks.identityUpsert).toHaveBeenCalledWith(expect.objectContaining({
      phone: "01012345678",
    }), { onConflict: "user_id" });
    expect(await response.json()).toEqual(expect.objectContaining({
      phone: "01012345678",
    }));
  });

  it("reuses an existing identity and rotates its stub password before sign-in", async () => {
    mocks.identityMaybeSingle.mockResolvedValue({
      data: { user_id: "resident-2", kakao_name: "Existing User", phone: "01099998888" },
      error: null,
    });
    mocks.getUserById.mockResolvedValue({
      data: { user: { id: "resident-2", email: "kakao_456@resident.stub" } },
      error: null,
    });

    const response = await POST(request({ kakaoId: "456" }));

    expect(response.status).toBe(200);
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.updateUserById).toHaveBeenCalledWith("resident-2", expect.objectContaining({
      email: "kakao_456@resident.stub",
      email_confirm: true,
    }));
    expect(mocks.identityUpsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "resident-2",
      kakao_name: "Existing User",
      phone: "01099998888",
    }), { onConflict: "user_id" });
  });

  it("finds an auth user by email after a duplicate create response", async () => {
    mocks.createUser.mockResolvedValue({
      data: { user: null },
      error: { code: "email_exists", message: "already registered" },
    });
    mocks.listUsers.mockResolvedValue({
      data: {
        users: [{ id: "resident-3", email: "kakao_789@resident.stub" }],
        nextPage: null,
      },
      error: null,
    });

    const response = await POST(request({ kakaoId: "789" }));

    expect(response.status).toBe(200);
    expect(mocks.listUsers).toHaveBeenCalledWith({ page: 1, perPage: 1_000 });
    expect(mocks.updateUserById).toHaveBeenCalledWith("resident-3", expect.any(Object));
  });

  it("rejects a Kakao id that cannot be used in the stub email", async () => {
    const response = await POST(request({ kakaoId: "bad@email" }));

    expect(response.status).toBe(422);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
