import { describe, expect, it, vi } from "vitest";
import { dispatchMessages } from "./dispatch";
import { PopbillSubmitError } from "@/lib/popbill/types";

function makeClient(handlers: Record<string, (args: Record<string, unknown>) => unknown>) {
  return {
    rpc: vi.fn((fn: string, args: Record<string, unknown>) =>
      Promise.resolve({ data: handlers[fn] ? handlers[fn](args) : null, error: null }),
    ),
  };
}

const twoSmsReserve = {
  ok: true,
  reservation_id: 5,
  message_log_id: 9,
  reserved_points: 2,
  resolved_recipients: [
    { phone: "010-1111-2222", name: "A", channel: "sms", product: "sms" },
    { phone: "010-3333-4444", name: "B", channel: "sms", product: "sms" },
  ],
  recipient_costs: [
    { recipient_key: "k1", product: "sms" },
    { recipient_key: "k2", product: "sms" },
  ],
};

const baseInput = {
  orgId: 10,
  userId: "u-1",
  mode: "sms" as const,
  body: "안녕하세요",
  context: "manual",
  templateId: null,
  recipients: [
    { name: "A", phone: "010-1111-2222", kind: "tenant" as const },
    { name: "B", phone: "010-3333-4444", kind: "tenant" as const },
  ],
};

describe("dispatchMessages", () => {
  it("설정 누락 시 PROVIDER_NOT_CONFIGURED(503)를 반환하고 아무 것도 접수하지 않는다", async () => {
    const sb = makeClient({});
    const admin = makeClient({});
    const submitBatch = vi.fn();
    const out = await dispatchMessages(baseInput, {
      sb,
      admin,
      submitBatch,
      isConfigured: () => false,
    });
    expect(out).toMatchObject({ ok: false, code: "PROVIDER_NOT_CONFIGURED", httpStatus: 503 });
    expect(submitBatch).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("견적→예약→접수→provider_pending으로 queued를 반환한다", async () => {
    const sb = makeClient({
      quote_message_points: () => ({ ok: true, rate_ids: { sms: 1 }, estimated_points: 2 }),
    });
    const admin = makeClient({
      reserve_message_points: () => twoSmsReserve,
      create_provider_dispatch_jobs: () => ({ ok: true }),
      mark_message_reservation_provider_pending: () => ({ ok: true, status: "provider_pending", accepted: 1 }),
    });
    const submitBatch = vi.fn().mockResolvedValue({
      requestNum: "m5c0",
      receiptNum: "RCPT-1",
      product: "sms",
      recipients: [],
    });
    const out = await dispatchMessages(baseInput, { sb, admin, submitBatch, isConfigured: () => true });
    expect(out).toMatchObject({ ok: true, status: "queued", logId: 9, queuedCount: 2, reservedPoints: 2 });
    expect(submitBatch).toHaveBeenCalledTimes(1); // 두 sms는 한 배치
    // mark은 accepted outcome으로 호출
    expect(admin.rpc).toHaveBeenCalledWith(
      "mark_message_reservation_provider_pending",
      expect.objectContaining({
        p_outcomes: [expect.objectContaining({ outcome: "accepted", receipt_num: "RCPT-1" })],
      }),
    );
  });

  it("접수 중 오류는 unknown(reconcile_required 후보)으로 남기고 즉시 재발송하지 않는다", async () => {
    const sb = makeClient({
      quote_message_points: () => ({ ok: true, rate_ids: { sms: 1 }, estimated_points: 2 }),
    });
    const markArgs: Record<string, unknown>[] = [];
    const admin = makeClient({
      reserve_message_points: () => twoSmsReserve,
      create_provider_dispatch_jobs: () => ({ ok: true }),
      mark_message_reservation_provider_pending: (args) => {
        markArgs.push(args);
        return { ok: true, status: "reconcile_required" };
      },
    });
    const submitBatch = vi.fn().mockRejectedValue(new PopbillSubmitError("506", "타임아웃"));
    const out = await dispatchMessages(baseInput, { sb, admin, submitBatch, isConfigured: () => true });
    expect(out).toMatchObject({ ok: true, status: "queued", queuedCount: 0 });
    expect(submitBatch).toHaveBeenCalledTimes(1);
    const outcomes = markArgs[0].p_outcomes as Array<{ outcome: string }>;
    expect(outcomes[0].outcome).toBe("unknown");
  });

  it("포인트 부족 예약 실패는 402로 반환하고 접수하지 않는다", async () => {
    const sb = makeClient({
      quote_message_points: () => ({ ok: true, rate_ids: { sms: 1 }, estimated_points: 2 }),
    });
    const admin = makeClient({
      reserve_message_points: () => ({ ok: false, code: "INSUFFICIENT_POINTS", required_points: 5 }),
    });
    const submitBatch = vi.fn();
    const out = await dispatchMessages(baseInput, { sb, admin, submitBatch, isConfigured: () => true });
    expect(out).toMatchObject({ ok: false, code: "INSUFFICIENT_POINTS", httpStatus: 402 });
    expect(submitBatch).not.toHaveBeenCalled();
  });
});
