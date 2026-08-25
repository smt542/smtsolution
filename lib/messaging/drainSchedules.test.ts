import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { drainSchedules } from "@/lib/messaging/drainSchedules";
import type { MessageBatchInput, MessageContent, ProviderSubmission } from "@/lib/popbill/types";

type RpcArgs = Record<string, unknown>;
type SubmitBatch = (batch: MessageBatchInput, content: MessageContent) => Promise<ProviderSubmission>;

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

const configured = () => true;
let submitBatch: Mock<SubmitBatch>;

const oneSmsReserve = {
  ok: true,
  reservation_status: "reserved",
  reservation_id: 55,
  message_log_id: 99,
  resolved_recipients: [{ phone: "01011112222", name: "A", channel: "sms", product: "sms" }],
  recipient_costs: [{ recipient_key: "k1", product: "sms" }],
  alimtalk_template_code: null,
  buttons: [],
};

beforeEach(() => {
  submitBatch = vi.fn().mockResolvedValue({
    requestNum: "m55c0",
    receiptNum: "RCPT-1",
    product: "sms",
    recipients: [],
  });
});

describe("drainSchedules (Popbill 접수 기반)", () => {
  it("claim 0건이면 아무것도 안 하고 0 집계", async () => {
    const { admin, calls } = makeAdmin({ claim_due_message_schedules: () => [] });
    const result = await drainSchedules({ admin, orgId: null, submitBatch, isConfigured: configured });

    expect(result).toEqual({ claimed: 0, queued: 0, failed: 0, unconfigured: 0, finalized: 0 });
    expect(calls.some((c) => c.fn === "reserve_scheduled_message")).toBe(false);
    expect(submitBatch).not.toHaveBeenCalled();
  });

  it("미설정이면 reserve 미호출·complete('failed')·unconfigured 집계", async () => {
    const { admin, calls } = makeAdmin({
      claim_due_message_schedules: () => [
        { id: 1, org_id: 7, channel: "sms", body: "안녕", context: "manual", recipients: [{}], template_id: null },
      ],
      complete_message_schedule: () => ({ ok: true }),
    });
    const result = await drainSchedules({ admin, orgId: 7, submitBatch, isConfigured: () => false });

    expect(result.unconfigured).toBe(1);
    expect(calls.some((c) => c.fn === "reserve_scheduled_message")).toBe(false);
    expect(submitBatch).not.toHaveBeenCalled();
    expect(calls.find((c) => c.fn === "complete_message_schedule")?.args).toMatchObject({
      p_schedule_id: 1,
      p_final: "failed",
    });
  });

  it("정상: reserve→배치 접수→provider_pending, 스케줄은 sending 유지(queued)", async () => {
    const { admin, calls } = makeAdmin({
      claim_due_message_schedules: () => [
        { id: 2, org_id: 7, channel: "sms", body: "본문", context: "manual", recipients: [{}], template_id: null },
      ],
      reserve_scheduled_message: () => oneSmsReserve,
      create_provider_dispatch_jobs: () => ({ ok: true }),
      mark_message_reservation_provider_pending: () => ({ ok: true, status: "provider_pending" }),
      complete_message_schedule: () => ({ ok: true }),
    });

    const result = await drainSchedules({ admin, orgId: 7, submitBatch, isConfigured: configured });

    expect(submitBatch).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ claimed: 1, queued: 1, failed: 0 });
    // 접수만 되었으므로 sent로 마감하지 않는다(complete 미호출).
    expect(calls.some((c) => c.fn === "complete_message_schedule")).toBe(false);
    expect(calls.some((c) => c.fn === "mark_message_reservation_provider_pending")).toBe(true);
  });

  it("예약 알림톡도 각 수신자의 변수로 버튼 URL을 렌더링해 배치에 전달한다", async () => {
    const { admin } = makeAdmin({
      claim_due_message_schedules: () => [
        {
          id: 8,
          org_id: 7,
          channel: "alimtalk",
          body: "알림톡 본문",
          context: "manual",
          recipients: [{}, {}],
          template_id: 17,
        },
      ],
      reserve_scheduled_message: () => ({
        ok: true,
        reservation_status: "reserved",
        reservation_id: 58,
        message_log_id: 108,
        resolved_recipients: [
          {
            phone: "01011112222",
            name: "A",
            channel: "alimtalk",
            product: "alimtalk",
            variables: { 상세토큰: "scheduled-a" },
          },
          {
            phone: "01033334444",
            name: "B",
            channel: "alimtalk",
            product: "alimtalk",
            variables: { 상세토큰: "scheduled-b" },
          },
        ],
        recipient_costs: [
          { recipient_key: "k1", product: "alimtalk" },
          { recipient_key: "k2", product: "alimtalk" },
        ],
        alimtalk_template_code: "TPL_001",
        buttons: [
          {
            type: "WL",
            name: "상세보기",
            url: "https://resident.example/r/#{상세토큰}",
            u2: "https://resident.example/desktop/#{상세토큰}",
          },
        ],
      }),
      create_provider_dispatch_jobs: () => ({ ok: true }),
      mark_message_reservation_provider_pending: () => ({ ok: true, status: "provider_pending" }),
    });

    const result = await drainSchedules({ admin, orgId: 7, submitBatch, isConfigured: configured });

    expect(result).toMatchObject({ claimed: 1, queued: 1, failed: 0 });
    const batch = submitBatch.mock.calls[0][0] as MessageBatchInput;
    expect(batch.recipients.map((recipient) => recipient.buttons?.[0].u1)).toEqual([
      "https://resident.example/r/scheduled-a",
      "https://resident.example/r/scheduled-b",
    ]);
    expect(batch.recipients.map((recipient) => recipient.buttons?.[0].u2)).toEqual([
      "https://resident.example/desktop/scheduled-a",
      "https://resident.example/desktop/scheduled-b",
    ]);
    expect(JSON.stringify(batch.recipients)).not.toContain("#{");
  });

  it("INSUFFICIENT_POINTS면 접수 미호출·complete('failed')", async () => {
    const { admin, calls } = makeAdmin({
      claim_due_message_schedules: () => [
        { id: 3, org_id: 7, channel: "sms", body: "b", context: "manual", recipients: [{}], template_id: null },
      ],
      reserve_scheduled_message: () => ({ ok: false, code: "INSUFFICIENT_POINTS" }),
      complete_message_schedule: () => ({ ok: true }),
    });

    const result = await drainSchedules({ admin, orgId: 7, submitBatch, isConfigured: configured });

    expect(submitBatch).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
    expect(calls.find((c) => c.fn === "complete_message_schedule")?.args).toMatchObject({ p_final: "failed" });
  });

  it("전 배치 확정 실패(mark released)면 complete('failed')로 마감", async () => {
    submitBatch.mockRejectedValue(new Error("rejected"));
    const { admin, calls } = makeAdmin({
      claim_due_message_schedules: () => [
        { id: 4, org_id: 7, channel: "sms", body: "b", context: "manual", recipients: [{}], template_id: null },
      ],
      reserve_scheduled_message: () => oneSmsReserve,
      create_provider_dispatch_jobs: () => ({ ok: true }),
      mark_message_reservation_provider_pending: () => ({ ok: true, status: "released" }),
      complete_message_schedule: () => ({ ok: true }),
    });

    const result = await drainSchedules({ admin, orgId: 7, submitBatch, isConfigured: configured });

    expect(result.failed).toBe(1);
    expect(calls.find((c) => c.fn === "complete_message_schedule")?.args).toMatchObject({
      p_schedule_id: 4,
      p_message_log_id: 99,
      p_final: "failed",
    });
  });

  it("이미 정산된 예약 replay(settled)면 접수 미호출·log_result로 마감(finalized)", async () => {
    const { admin, calls } = makeAdmin({
      claim_due_message_schedules: () => [
        { id: 5, org_id: 7, channel: "sms", body: "b", context: "manual", recipients: [{}], template_id: null },
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

    const result = await drainSchedules({ admin, orgId: 7, submitBatch, isConfigured: configured });

    expect(submitBatch).not.toHaveBeenCalled();
    expect(result.finalized).toBe(1);
    expect(calls.find((c) => c.fn === "complete_message_schedule")?.args).toMatchObject({
      p_schedule_id: 5,
      p_message_log_id: 42,
      p_final: "sent",
    });
  });

  it("한 행이 예외를 던져도 다음 행을 계속 처리", async () => {
    let reserveCall = 0;
    const { admin } = makeAdmin({
      claim_due_message_schedules: () => [
        { id: 6, org_id: 7, channel: "sms", body: "b", context: "manual", recipients: [{}], template_id: null },
        { id: 7, org_id: 7, channel: "sms", body: "b", context: "manual", recipients: [{}], template_id: null },
      ],
      reserve_scheduled_message: () => {
        reserveCall += 1;
        if (reserveCall === 1) throw new Error("boom");
        return oneSmsReserve;
      },
      create_provider_dispatch_jobs: () => ({ ok: true }),
      mark_message_reservation_provider_pending: () => ({ ok: true, status: "provider_pending" }),
      complete_message_schedule: () => ({ ok: true }),
    });

    const result = await drainSchedules({ admin, orgId: 7, submitBatch, isConfigured: configured });

    expect(result.claimed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.queued).toBe(1);
  });
});
