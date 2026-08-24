import { describe, expect, it, vi } from "vitest";
import { dispatchMessages, submitReservationBatches } from "./dispatch";
import { PopbillSubmitError, PopbillTimeoutError, type MessageBatchInput } from "@/lib/popbill/types";

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
  idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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

  it("공급자 확정 거절(PopbillSubmitError)은 failed로 처리하고 전부 거절(released)이면 non-202 실패를 반환한다", async () => {
    const sb = makeClient({
      quote_message_points: () => ({ ok: true, rate_ids: { sms: 1 }, estimated_points: 2 }),
    });
    const markArgs: Record<string, unknown>[] = [];
    const admin = makeClient({
      reserve_message_points: () => twoSmsReserve,
      create_provider_dispatch_jobs: () => ({ ok: true }),
      mark_message_reservation_provider_pending: (args) => {
        markArgs.push(args);
        return { ok: true, status: "released", failed: 1 };
      },
    });
    const submitBatch = vi.fn().mockRejectedValue(new PopbillSubmitError("-99", "발신번호 미등록"));
    const out = await dispatchMessages(baseInput, { sb, admin, submitBatch, isConfigured: () => true });
    // 접수 receipt가 없으므로 queued로 보고하지 않고 명확한 실패를 반환한다.
    expect(out).toMatchObject({ ok: false, code: "SEND_REJECTED", httpStatus: 502 });
    expect(out.status).toBeUndefined();
    const outcomes = markArgs[0].p_outcomes as Array<{ outcome: string }>;
    expect(outcomes[0].outcome).toBe("failed");
  });

  it("전송 타임아웃(PopbillTimeoutError)은 unknown으로 남기고 receipt 없는 접수를 queued로 보고하지 않는다", async () => {
    const sb = makeClient({
      quote_message_points: () => ({ ok: true, rate_ids: { sms: 1 }, estimated_points: 2 }),
    });
    const markArgs: Record<string, unknown>[] = [];
    const admin = makeClient({
      reserve_message_points: () => twoSmsReserve,
      create_provider_dispatch_jobs: () => ({ ok: true }),
      mark_message_reservation_provider_pending: (args) => {
        markArgs.push(args);
        return { ok: true, status: "reconcile_required", unknown: 1 };
      },
    });
    const submitBatch = vi.fn().mockRejectedValue(new PopbillTimeoutError());
    const out = await dispatchMessages(baseInput, { sb, admin, submitBatch, isConfigured: () => true });
    expect(out).toMatchObject({ ok: false, code: "SEND_UNCONFIRMED", httpStatus: 502 });
    expect(submitBatch).toHaveBeenCalledTimes(1);
    const outcomes = markArgs[0].p_outcomes as Array<{ outcome: string }>;
    expect(outcomes[0].outcome).toBe("unknown"); // 즉시 재발송하지 않고 reconcile 대상으로 남긴다
  });

  it("input.idempotencyKey를 reserve_message_points p_idempotency_key로 전달한다(per-call randomUUID 제거)", async () => {
    const sb = makeClient({
      quote_message_points: () => ({ ok: true, rate_ids: { sms: 1 }, estimated_points: 2 }),
    });
    let reserveArgs: Record<string, unknown> | null = null;
    const admin = makeClient({
      reserve_message_points: (args) => {
        reserveArgs = args;
        return twoSmsReserve;
      },
      create_provider_dispatch_jobs: () => ({ ok: true }),
      mark_message_reservation_provider_pending: () => ({ ok: true, status: "provider_pending" }),
    });
    const submitBatch = vi.fn().mockResolvedValue({ requestNum: "m5c0", receiptNum: "R", product: "sms", recipients: [] });
    await dispatchMessages(
      { ...baseInput, idempotencyKey: "11111111-1111-4111-8111-111111111111" },
      { sb, admin, submitBatch, isConfigured: () => true },
    );
    expect(reserveArgs!.p_idempotency_key).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("동일 키 재시도(예약 replay)는 재접수/재마킹/재작업생성을 하지 않고 안전한 queued를 반환한다", async () => {
    const sb = makeClient({
      quote_message_points: () => ({ ok: true, rate_ids: { sms: 1 }, estimated_points: 2 }),
    });
    let reserveCalls = 0;
    const admin = makeClient({
      reserve_message_points: () => {
        reserveCalls += 1;
        return reserveCalls === 1
          ? { ...twoSmsReserve, replayed: false }
          : {
              ok: true,
              replayed: true,
              status: "provider_pending",
              reservation_id: 5,
              message_log_id: 9,
              reserved_points: 2,
            };
      },
      create_provider_dispatch_jobs: () => ({ ok: true }),
      mark_message_reservation_provider_pending: () => ({ ok: true, status: "provider_pending", accepted: 1 }),
    });
    const submitBatch = vi.fn().mockResolvedValue({ requestNum: "m5c0", receiptNum: "RCPT", product: "sms", recipients: [] });
    const first = await dispatchMessages(baseInput, { sb, admin, submitBatch, isConfigured: () => true });
    const second = await dispatchMessages(baseInput, { sb, admin, submitBatch, isConfigured: () => true });
    expect(first).toMatchObject({ ok: true, status: "queued" });
    expect(second).toMatchObject({ ok: true, status: "queued" });
    // 정확히 한 번만 접수(submit)·마킹(mark)·작업생성(create)한다.
    expect(submitBatch).toHaveBeenCalledTimes(1);
    const rpcNames = (admin.rpc as unknown as { mock: { calls: [string, unknown][] } }).mock.calls.map((c) => c[0]);
    expect(rpcNames.filter((n) => n === "mark_message_reservation_provider_pending")).toHaveLength(1);
    expect(rpcNames.filter((n) => n === "create_provider_dispatch_jobs")).toHaveLength(1);
  });

  it("released 예약의 replay는 재발송 없이 동일한 안전 실패(SEND_REJECTED)를 반환한다", async () => {
    const sb = makeClient({
      quote_message_points: () => ({ ok: true, rate_ids: { sms: 1 }, estimated_points: 2 }),
    });
    const admin = makeClient({
      reserve_message_points: () => ({
        ok: true,
        replayed: true,
        status: "released",
        reservation_id: 5,
        message_log_id: 9,
        reserved_points: 0,
      }),
      create_provider_dispatch_jobs: () => ({ ok: true }),
      mark_message_reservation_provider_pending: () => ({ ok: true, status: "released" }),
    });
    const submitBatch = vi.fn();
    const out = await dispatchMessages(baseInput, { sb, admin, submitBatch, isConfigured: () => true });
    expect(out).toMatchObject({ ok: false, code: "SEND_REJECTED" });
    expect(submitBatch).not.toHaveBeenCalled();
  });

  it("submitReservationBatches: 즉시/예약 공용 경로에서 수신자별 renderedBody를 배치에 전달한다", async () => {
    const admin = makeClient({
      create_provider_dispatch_jobs: () => ({ ok: true }),
      mark_message_reservation_provider_pending: () => ({ ok: true, status: "provider_pending" }),
    });
    const captured: MessageBatchInput[] = [];
    const submitBatch = vi.fn(async (batch: MessageBatchInput) => {
      captured.push(batch);
      return { requestNum: batch.requestNum, receiptNum: "R", product: batch.product, recipients: [] };
    });
    await submitReservationBatches(
      admin,
      {
        reservationId: 5,
        scheduleId: null,
        body: "공통본문",
        templateId: null,
        resolved: [
          { phone: "010-1111-2222", name: "A", channel: "sms", product: "sms", renderedBody: "A님 3만원" },
          { phone: "010-3333-4444", name: "B", channel: "sms", product: "sms", renderedBody: "B님 5만원" },
        ],
        costs: [
          { recipient_key: "k1", product: "sms" },
          { recipient_key: "k2", product: "sms" },
        ],
      },
      { submitBatch },
    );
    expect(captured).toHaveLength(1);
    expect(captured[0].recipients.map((r) => r.renderedBody)).toEqual(["A님 3만원", "B님 5만원"]);
  });

  it("submitReservationBatches: 제품이 다른 수신자(sms/lms)를 제품별 배치로 나누고 본문을 맞춰 접수한다", async () => {
    const admin = makeClient({
      create_provider_dispatch_jobs: () => ({ ok: true }),
      mark_message_reservation_provider_pending: () => ({ ok: true, status: "provider_pending" }),
    });
    const captured: MessageBatchInput[] = [];
    const submitBatch = vi.fn(async (batch: MessageBatchInput) => {
      captured.push(batch);
      return { requestNum: batch.requestNum, receiptNum: "R", product: batch.product, recipients: [] };
    });
    const longBody = "긴 본문".repeat(50);
    await submitReservationBatches(
      admin,
      {
        reservationId: 8,
        scheduleId: null,
        body: "공통본문",
        templateId: null,
        // 견적(resolve_message_point_quote)이 수신자별 renderedBody로 판정한 제품이 recipient_costs.product로 온다.
        resolved: [
          { phone: "010-1111-2222", name: "짧", channel: "sms", product: "sms", renderedBody: "짧은 본문" },
          { phone: "010-3333-4444", name: "긴", channel: "sms", product: "lms", renderedBody: longBody },
        ],
        costs: [
          { recipient_key: "k1", product: "sms" },
          { recipient_key: "k2", product: "lms" },
        ],
      },
      { submitBatch },
    );
    const sms = captured.find((b) => b.product === "sms");
    const lms = captured.find((b) => b.product === "lms");
    expect(sms?.recipients).toHaveLength(1);
    expect(lms?.recipients).toHaveLength(1);
    expect(sms?.recipients[0].renderedBody).toBe("짧은 본문");
    expect(lms?.recipients[0].renderedBody).toBe(longBody);
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
