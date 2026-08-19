import { beforeEach, describe, expect, it } from "vitest";

import {
  approveMockPending,
  automatch,
  confirm,
  DEMO_UNMATCHED_IDENTITY,
  getActiveCandidate,
  getPendingInfo,
  getSession,
  kakaoStubLogin,
  logout,
  myLink,
  requestClaim,
  searchBuildings,
} from "./onboardingClient";

beforeEach(() => {
  logout();
});

describe("resident onboarding client", () => {
  it("automatches the seeded household for the default Kakao identity", async () => {
    await kakaoStubLogin();

    const candidates = await automatch();

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      buildingName: "그린빌라",
      unitNo: "201호",
      tenantName: "박정호",
    });
    expect(getActiveCandidate()).toEqual(candidates[0]);
  });

  it("does not automatch the unmatched demo identity", async () => {
    await kakaoStubLogin(DEMO_UNMATCHED_IDENTITY);

    await expect(automatch()).resolves.toEqual([]);
    expect(getActiveCandidate()).toBeNull();
  });

  it("links the matched household after confirmation", async () => {
    await kakaoStubLogin();
    const [candidate] = await automatch();

    await expect(confirm(candidate.occupancyId)).resolves.toEqual({
      status: "linked",
    });
    await expect(myLink()).resolves.toEqual({
      buildingName: candidate.buildingName,
      unitNo: candidate.unitNo,
      tenantName: candidate.tenantName,
    });
  });

  it("stores unit and search claim details", async () => {
    await kakaoStubLogin();

    await requestClaim({
      buildingId: "bld_greenvilla",
      unitText: "201",
      kind: "unit",
    });

    expect(getPendingInfo()).toMatchObject({
      buildingName: "그린빌라",
      unitNo: "201호",
      orgName: "스마일종합관리",
      orgPhone: "042-822-4410",
    });

    await requestClaim({ kind: "search" });

    expect(getPendingInfo()).toMatchObject({
      buildingName: "",
      unitNo: "",
      orgName: "스마일종합관리",
      orgPhone: "042-822-4410",
    });
  });

  it("returns all buildings for an empty query and filters by substring", async () => {
    const allBuildings = await searchBuildings("");
    const filteredBuildings = await searchBuildings("그린");

    expect(allBuildings.length).toBeGreaterThan(1);
    expect(filteredBuildings.length).toBeLessThan(allBuildings.length);
    expect(filteredBuildings).toEqual([
      expect.objectContaining({ id: "bld_greenvilla", name: "그린빌라" }),
    ]);
  });

  it("approves a pending claim and logout clears all resident state", async () => {
    await kakaoStubLogin();
    await requestClaim({
      buildingId: "bld_greenvilla",
      unitText: "201",
      kind: "unit",
    });

    await approveMockPending();

    await expect(myLink()).resolves.toMatchObject({
      buildingName: "그린빌라",
      unitNo: "201호",
    });

    logout();

    expect(getSession()).toBeNull();
    await expect(myLink()).resolves.toBeNull();
    expect(getPendingInfo()).toBeNull();
  });
});
