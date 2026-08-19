import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

import {
  approveResidentClaim,
  listResidentClaims,
  rejectResidentClaim,
  residentAutomatch,
  residentConfirm,
  residentMyLink,
  residentRequestClaim,
  stubResidentKakaoLogin,
} from "./apis";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resident claims APIs", () => {
  it("posts the optional identity to the Kakao stub route", async () => {
    const payload = {
      userId: "resident-1",
      kakaoId: "123",
      name: "Stub User",
      phone: "01012345678",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    }));

    await expect(stubResidentKakaoLogin({ kakaoId: "123" })).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledWith("/api/resident/kakao/stub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kakaoId: "123" }),
    });
  });

  it("maps automatch and current-link RPC rows", async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{
          org_id: 1,
          building_id: 2,
          building_name: "Building 2",
          unit_id: 3,
          unit_no: "101",
          occupancy_id: 4,
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{
          claim_id: 5,
          org_id: 1,
          building_id: 2,
          building_name: "Building 2",
          unit_id: 3,
          unit_no: "101",
          occupancy_id: 4,
          tenant_name: "Resident",
          occupancy_phone: "01012345678",
          linked_at: "2026-08-19T00:00:00Z",
        }],
        error: null,
      });

    await expect(residentAutomatch()).resolves.toEqual([{
      orgId: 1,
      buildingId: 2,
      buildingName: "Building 2",
      unitId: 3,
      unitNo: "101",
      occupancyId: 4,
    }]);
    await expect(residentMyLink()).resolves.toMatchObject({
      claimId: 5,
      occupancyId: 4,
      tenantName: "Resident",
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "resident_automatch");
    expect(rpc).toHaveBeenNthCalledWith(2, "resident_my_link");
  });

  it("maps staff claim rows and passes the status filter", async () => {
    rpc.mockResolvedValue({
      data: [{
        claim_id: 5,
        org_id: 1,
        resident_user_id: "resident-1",
        kakao_id: "123",
        kakao_name: "Stub User",
        resident_phone: "01012345678",
        claimed_name: "Stub User",
        claimed_phone: "01012345678",
        building_id: 2,
        building_name: "Building 2",
        unit_id: null,
        unit_no: null,
        claimed_unit_text: "101",
        occupancy_id: null,
        occupancy_tenant_name: null,
        occupancy_phone: null,
        status: "pending",
        kind: "manual",
        memo: null,
        created_at: "2026-08-19T00:00:00Z",
        resolved_at: null,
        resolved_by: null,
      }],
      error: null,
    });

    const claims = await listResidentClaims("pending");

    expect(rpc).toHaveBeenCalledWith("list_res_claims", { p_status: "pending" });
    expect(claims[0]).toMatchObject({
      claimId: 5,
      residentUserId: "resident-1",
      claimedUnitText: "101",
      status: "pending",
    });
  });

  it("passes resident and staff mutation arguments to their RPCs", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await residentConfirm(4);
    await residentRequestClaim({ buildingId: 2, unitText: "101" });
    await approveResidentClaim({ claimId: 5, occupancyId: 4 });
    await rejectResidentClaim(6);

    expect(rpc).toHaveBeenNthCalledWith(1, "resident_confirm", { p_occupancy_id: 4 });
    expect(rpc).toHaveBeenNthCalledWith(2, "resident_request_claim", {
      p_building_id: 2,
      p_unit_text: "101",
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "approve_res_claim", {
      p_claim_id: 5,
      p_occupancy_id: 4,
    });
    expect(rpc).toHaveBeenNthCalledWith(4, "reject_res_claim", { p_claim_id: 6 });
  });

  it("propagates RPC failures", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "claim lookup failed" } });

    await expect(residentMyLink()).rejects.toThrow("claim lookup failed");
  });
});
