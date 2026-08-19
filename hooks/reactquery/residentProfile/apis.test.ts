import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

import { residentGetProfile, residentSetNotifyPrefs } from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("resident profile APIs", () => {
  it("maps the profile row to camelCase", async () => {
    rpc.mockResolvedValue({
      data: [{
        tenant_name: "김주민",
        phone: "01012345678",
        building_name: "해오름빌라",
        unit_no: "201호",
        move_in_date: "2025-03-01",
        org_id: 2,
        org_name: "해오름관리",
        transfer_method: "auto_transfer",
        bill_delivery: "alimtalk",
        alimtalk_opt_in: true,
        sms_opt_in: false,
        linked_at: "2026-08-19T01:00:00Z",
      }],
      error: null,
    });

    await expect(residentGetProfile()).resolves.toEqual({
      tenantName: "김주민",
      phone: "01012345678",
      buildingName: "해오름빌라",
      unitNo: "201호",
      moveInDate: "2025-03-01",
      orgId: 2,
      orgName: "해오름관리",
      transferMethod: "auto_transfer",
      billDelivery: "alimtalk",
      alimtalkOptIn: true,
      smsOptIn: false,
      linkedAt: "2026-08-19T01:00:00Z",
    });
    expect(rpc).toHaveBeenCalledWith("resident_get_profile");
  });

  it("passes both exact preference argument keys", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await residentSetNotifyPrefs({ alimtalk: false });
    await residentSetNotifyPrefs({ sms: true });

    expect(rpc).toHaveBeenNthCalledWith(1, "resident_set_notify_prefs", {
      p_alimtalk: false,
      p_sms: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "resident_set_notify_prefs", {
      p_alimtalk: null,
      p_sms: true,
    });
  });
});
