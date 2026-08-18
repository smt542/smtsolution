import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc }),
}));

import {
  listMessagePointRates,
  listPointReservations,
  releaseStalePointReservation,
  setMessagePointRates,
} from "./pointBilling";

beforeEach(() => vi.clearAllMocks());

describe("platform point billing apis", () => {
  it("활성 단가를 snake_case에서 변환한다", async () => {
    rpc.mockResolvedValue({
      data: [{
        id: 2,
        channel: "sms",
        points: 1,
        effective_from: "2026-08-18T00:00:00Z",
        effective_to: null,
        is_active: true,
        created_by: "operator",
        created_at: "2026-08-18T00:00:00Z",
      }],
      error: null,
    });

    await expect(listMessagePointRates()).resolves.toEqual([
      expect.objectContaining({ channel: "sms", points: 1, isActive: true }),
    ]);
    expect(rpc).toHaveBeenCalledWith("platform_list_message_point_rates", {
      p_include_history: false,
    });
  });

  it("두 채널 단가를 한 RPC로 변경한다", async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });

    await setMessagePointRates({ smsPoints: 2, alimtalkPoints: 3 });

    expect(rpc).toHaveBeenCalledWith("platform_set_message_point_rates", {
      p_sms_points: 2,
      p_alimtalk_points: 3,
    });
  });

  it("예약 목록을 변환하고 상태 필터를 전달한다", async () => {
    rpc.mockResolvedValue({
      data: [{
        id: 4,
        org_id: 7,
        organization_name: "한빛관리",
        message_log_id: 9,
        status: "reconcile_required",
        reserved_points: 20,
        charged_points: 0,
        age_seconds: 120,
        is_releasable: true,
        expires_at: "2026-08-18T01:00:00Z",
        created_at: "2026-08-18T00:00:00Z",
        requested_by: "user-1",
        requested_by_name: "김관리",
      }],
      error: null,
    });

    await expect(listPointReservations("reconcile_required")).resolves.toEqual([
      expect.objectContaining({
        id: 4,
        orgId: 7,
        organizationName: "한빛관리",
        reservedPoints: 20,
        isReleasable: true,
      }),
    ]);
    expect(rpc).toHaveBeenCalledWith("platform_list_point_reservations", {
      p_status: "reconcile_required",
    });
  });

  it("수동 예약 해제 사유를 trim해 전달한다", async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });

    await releaseStalePointReservation(4, "  공급자 미접수 확인  ");

    expect(rpc).toHaveBeenCalledWith("platform_release_stale_reservation", {
      p_id: 4,
      p_reason: "공급자 미접수 확인",
    });
  });
});
