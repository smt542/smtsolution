import { beforeEach, describe, expect, it, vi } from "vitest";

const dispatchOne = vi.fn();
const anyChannelConfigured = vi.fn();
vi.mock("@/lib/messaging/dispatch", () => ({
  dispatchOne: (...args: unknown[]) => dispatchOne(...args),
  anyChannelConfigured: (...args: unknown[]) => anyChannelConfigured(...args),
}));

import { drainSchedules } from "@/lib/messaging/drainSchedules";

type RpcArgs = Record<string, unknown>;

/** function 이름별로 응답을 라우팅하는 admin.rpc 목 */
function makeAdmin(handlers: Record<string, (args: RpcArgs) => unknown>) {
  const calls: { fn: string; args: RpcArgs }[] = [];
  const admin = {
    rpc: vi.fn(async (fn: string, args: RpcArgs = {}) => {
      calls.push({ fn, args });
      const handler = handlers[fn];
      const data = handler ? handler(args) : null;
      return { data, error: null };
    }),
  };
  return { admin, calls };
}

beforeEach(() => {
  dispatchOne.mockReset();
  anyChannelConfigured.mockReset();
});

describe("drainSchedules", () => {
  it("claim 0건이면 아무것도 안 하고 0 집계", async () => {
    const { admin, calls } = makeAdmin({ claim_due_message_schedules: () => [] });
    const result = await drainSchedules({ admin, orgId: null });

    expect(result).toEqual({
      claimed: 0,
      sent: 0,
      failed: 0,
      unconfigured: 0,
      chargedPoints: 0,
    });
    expect(calls.some((call) => call.fn === "reserve_scheduled_message")).toBe(false);
  });

  it("미설정 채널이면 reserve 미호출·complete('failed')·unconfigured 집계 [D5]", async () => {
    anyChannelConfigured.mockReturnValue(false);
    const { admin, calls } = makeAdmin({
      claim_due_message_schedules: () => [
        {
          id: 1,
          org_id: 7,
          channel: "sms",
          body: "안녕",
          context: "manual",
          recipients: [{ phone: "01011112222" }],
          template_id: null,
        },
      ],
      complete_message_schedule: () => ({ ok: true }),
    });

    const result = await drainSchedules({ admin, orgId: 7 });

    expect(result.unconfigured).toBe(1);
    expect(calls.some((call) => call.fn === "reserve_scheduled_message")).toBe(false);
    expect(calls.find((call) => call.fn === "complete_message_schedule")?.args).toMatchObject({
      p_schedule_id: 1,
      p_message_log_id: null,
      p_final: "failed",
    });
  });

  it("정상: reserve→dispatch×N→settle→complete('sent'), chargedPoints 누적", async () => {
    anyChannelConfigured.mockReturnValue(true);
    dispatchOne.mockResolvedValue({ status: "success", providerId: "p1" });
    const { admin, calls } = makeAdmin({
      claim_due_message_schedules: () => [
        {
          id: 2,
          org_id: 7,
          channel: "sms",
          body: "본문",
          context: "manual",
          recipients: [{ phone: "010" }],
          template_id: null,
        },
      ],
      reserve_scheduled_message: () => ({
        ok: true,
        reservation_status: "reserved",
        reservation_id: 55,
        message_log_id: 99,
        resolved_recipients: [{ phone: "01011112222", channel: "sms" }],
        recipient_costs: [{ recipient_key: "k1", channel: "sms" }],
        alimtalk_template_code: null,
        buttons: [],
      }),
      settle_message_points: () => ({ result: "sent", charged_points: 3 }),
      complete_message_schedule: () => ({ ok: true }),
    });

    const result = await drainSchedules({ admin, orgId: 7 });

    expect(dispatchOne).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ claimed: 1, sent: 1, chargedPoints: 3 });
    expect(calls.find((call) => call.fn === "settle_message_points")?.args).toMatchObject({
      p_reservation_id: 55,
      p_results: [{ recipient_key: "k1", status: "success" }],
    });
    expect(calls.find((call) => call.fn === "complete_message_schedule")?.args).toMatchObject({
      p_schedule_id: 2,
      p_message_log_id: 99,
      p_final: "sent",
    });
  });

  it("INSUFFICIENT_POINTS면 dispatch 미호출·complete('failed') [D6]", async () => {
    anyChannelConfigured.mockReturnValue(true);
    const { admin, calls } = makeAdmin({
      claim_due_message_schedules: () => [
        {
          id: 3,
          org_id: 7,
          channel: "sms",
          body: "b",
          context: "manual",
          recipients: [{ phone: "010" }],
          template_id: null,
        },
      ],
      reserve_scheduled_message: () => ({ ok: false, code: "INSUFFICIENT_POINTS" }),
      complete_message_schedule: () => ({ ok: true }),
    });

    const result = await drainSchedules({ admin, orgId: 7 });

    expect(dispatchOne).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
    expect(calls.find((call) => call.fn === "complete_message_schedule")?.args).toMatchObject({
      p_final: "failed",
    });
  });

  it("settle result='partial'이면 final='sent'", async () => {
    anyChannelConfigured.mockReturnValue(true);
    dispatchOne
      .mockResolvedValueOnce({ status: "success" })
      .mockResolvedValueOnce({ status: "failed", reason: "x" });
    const { admin, calls } = makeAdmin({
      claim_due_message_schedules: () => [
        {
          id: 4,
          org_id: 7,
          channel: "sms",
          body: "b",
          context: "manual",
          recipients: [{}, {}],
          template_id: null,
        },
      ],
      reserve_scheduled_message: () => ({
        ok: true,
        reservation_status: "reserved",
        reservation_id: 1,
        message_log_id: 2,
        resolved_recipients: [
          { phone: "a", channel: "sms" },
          { phone: "b", channel: "sms" },
        ],
        recipient_costs: [{ recipient_key: "k1" }, { recipient_key: "k2" }],
      }),
      settle_message_points: () => ({ result: "partial", charged_points: 1 }),
      complete_message_schedule: () => ({ ok: true }),
    });

    const result = await drainSchedules({ admin, orgId: 7 });

    expect(calls.find((call) => call.fn === "complete_message_schedule")?.args).toMatchObject({
      p_final: "sent",
    });
    expect(result.sent).toBe(1);
  });

  it("정산완료 replay(reservation_status='settled')면 dispatch 미호출·log_result로 complete", async () => {
    anyChannelConfigured.mockReturnValue(true);
    const { admin, calls } = makeAdmin({
      claim_due_message_schedules: () => [
        {
          id: 5,
          org_id: 7,
          channel: "sms",
          body: "b",
          context: "manual",
          recipients: [{}],
          template_id: null,
        },
      ],
      reserve_scheduled_message: () => ({
        ok: true,
        replayed: true,
        reservation_status: "settled",
        message_log_id: 42,
        log_result: "sent",
      }),
      complete_message_schedule: () => ({ ok: true }),
    });

    const result = await drainSchedules({ admin, orgId: 7 });

    expect(dispatchOne).not.toHaveBeenCalled();
    expect(calls.find((call) => call.fn === "complete_message_schedule")?.args).toMatchObject({
      p_schedule_id: 5,
      p_message_log_id: 42,
      p_final: "sent",
    });
    expect(result.sent).toBe(1);
  });

  it("한 행이 예외를 던져도 다음 행을 계속 처리", async () => {
    anyChannelConfigured.mockReturnValue(true);
    dispatchOne.mockResolvedValue({ status: "success" });
    let reserveCall = 0;
    const { admin } = makeAdmin({
      claim_due_message_schedules: () => [
        {
          id: 6,
          org_id: 7,
          channel: "sms",
          body: "b",
          context: "manual",
          recipients: [{}],
          template_id: null,
        },
        {
          id: 7,
          org_id: 7,
          channel: "sms",
          body: "b",
          context: "manual",
          recipients: [{}],
          template_id: null,
        },
      ],
      reserve_scheduled_message: () => {
        reserveCall += 1;
        if (reserveCall === 1) throw new Error("boom");
        return {
          ok: true,
          reservation_status: "reserved",
          reservation_id: 1,
          message_log_id: 2,
          resolved_recipients: [{ phone: "a", channel: "sms" }],
          recipient_costs: [{ recipient_key: "k1" }],
        };
      },
      settle_message_points: () => ({ result: "sent", charged_points: 1 }),
      complete_message_schedule: () => ({ ok: true }),
    });

    const result = await drainSchedules({ admin, orgId: 7 });

    expect(result.claimed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(1);
  });
});
