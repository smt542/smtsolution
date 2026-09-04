import { beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({
  signOut: vi.fn(async () => ({ error: null })),
  getUser: vi.fn(),
  identityMaybeSingle: vi.fn(),
}));

vi.mock("@/hooks/reactquery/residentClaims", () => ({
  stubResidentKakaoLogin: vi.fn(),
  residentAutomatch: vi.fn(),
  residentConfirm: vi.fn(),
  residentRequestClaim: vi.fn(),
  residentMyLink: vi.fn(),
  residentSearchBuildings: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: supabase.signOut, getUser: supabase.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: supabase.identityMaybeSingle }),
      }),
    }),
  }),
}));

import * as api from "@/hooks/reactquery/residentClaims";

import {
  automatch,
  confirm,
  getActiveCandidate,
  getPendingInfo,
  getSession,
  kakaoStubLogin,
  loadSession,
  logout,
  myLink,
  requestClaim,
  searchBuildings,
} from "./onboardingClient";

const loginResult = {
  userId: "resident-user-1",
  kakaoId: "kakao-7788",
  name: "박정호",
  phone: "010-2000-7788",
};

const automatchRow = {
  orgId: 7,
  buildingId: 5,
  buildingName: "그린빌라",
  unitId: 20,
  unitNo: "201호",
  occupancyId: 123,
};

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(api.stubResidentKakaoLogin).mockResolvedValue(loginResult);
  vi.mocked(api.residentAutomatch).mockResolvedValue([]);
  vi.mocked(api.residentConfirm).mockResolvedValue(undefined);
  vi.mocked(api.residentRequestClaim).mockResolvedValue(undefined);
  vi.mocked(api.residentMyLink).mockResolvedValue(null);
  vi.mocked(api.residentSearchBuildings).mockResolvedValue([]);
  supabase.getUser.mockResolvedValue({ data: { user: null }, error: null });
  supabase.identityMaybeSingle.mockResolvedValue({ data: null, error: null });
  await logout();
});

describe("resident onboarding client", () => {
  it("stores the identity returned by the O1 Kakao stub login", async () => {
    await expect(kakaoStubLogin()).resolves.toEqual({ ok: true });

    expect(api.stubResidentKakaoLogin).toHaveBeenCalledWith({
      kakaoId: undefined,
      name: undefined,
      phone: undefined,
    });
    expect(getSession()).toEqual({
      identity: {
        kakaoId: loginResult.kakaoId,
        name: loginResult.name,
        phone: loginResult.phone,
      },
    });
  });

  it("rehydrates identity after the full-page OAuth callback", async () => {
    supabase.getUser.mockResolvedValue({
      data: { user: { id: "resident-user-2" } },
      error: null,
    });
    supabase.identityMaybeSingle.mockResolvedValue({
      data: {
        kakao_id: "998877",
        kakao_name: "OAuth Resident",
        phone: null,
      },
      error: null,
    });

    await expect(loadSession()).resolves.toEqual({
      identity: {
        kakaoId: "998877",
        name: "OAuth Resident",
        phone: null,
      },
    });
  });

  it("maps O1 automatch rows and caches the first candidate", async () => {
    vi.mocked(api.residentAutomatch).mockResolvedValue([automatchRow]);

    const candidates = await automatch();

    expect(candidates).toEqual([
      {
        occupancyId: 123,
        buildingId: 5,
        buildingName: "그린빌라",
        unitNo: "201호",
        orgId: 7,
      },
    ]);
    expect(getActiveCandidate()).toEqual(candidates[0]);
  });

  it("confirms an occupancy through O1", async () => {
    await expect(confirm(123)).resolves.toEqual({ status: "linked" });

    expect(api.residentConfirm).toHaveBeenCalledWith(123);
  });

  it("submits a required-building claim and caches its pending display", async () => {
    await expect(
      requestClaim({
        buildingId: 5,
        unitText: "201",
        buildingName: "그린빌라",
      }),
    ).resolves.toEqual({ status: "pending" });

    expect(api.residentRequestClaim).toHaveBeenCalledWith({
      buildingId: 5,
      unitText: "201",
    });
    expect(getPendingInfo()).toEqual({
      buildingName: "그린빌라",
      unitNo: "201호",
      requestedAt: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(getPendingInfo()?.requestedAt ?? ""))).toBe(
      false,
    );
  });

  it("maps the current O1 link and preserves a null response", async () => {
    vi.mocked(api.residentMyLink)
      .mockResolvedValueOnce({
        claimId: 44,
        orgId: 7,
        buildingId: 5,
        buildingName: "그린빌라",
        unitId: 20,
        unitNo: "201호",
        occupancyId: 123,
        tenantName: "박정호",
        occupancyPhone: "010-2000-7788",
        linkedAt: "2026-08-19T03:00:00.000Z",
      })
      .mockResolvedValueOnce(null);

    await expect(myLink()).resolves.toEqual({
      buildingName: "그린빌라",
      unitNo: "201호",
      tenantName: "박정호",
    });
    await expect(myLink()).resolves.toBeNull();
  });

  it("maps O1 building results and normalizes a null address", async () => {
    vi.mocked(api.residentSearchBuildings).mockResolvedValue([
      {
        buildingId: 5,
        orgId: 7,
        name: "그린빌라",
        address: null,
      },
    ]);

    await expect(searchBuildings("그린")).resolves.toEqual([
      { id: 5, name: "그린빌라", address: "" },
    ]);
    expect(api.residentSearchBuildings).toHaveBeenCalledWith("그린");
  });

  it("clears all facade state and signs out of Supabase", async () => {
    vi.mocked(api.residentAutomatch).mockResolvedValue([automatchRow]);
    await kakaoStubLogin();
    await automatch();
    await requestClaim({
      buildingId: 5,
      unitText: "201",
      buildingName: "그린빌라",
    });
    supabase.signOut.mockClear();

    await logout();

    expect(getSession()).toBeNull();
    expect(getPendingInfo()).toBeNull();
    expect(getActiveCandidate()).toBeNull();
    expect(supabase.signOut).toHaveBeenCalledOnce();
  });
});
