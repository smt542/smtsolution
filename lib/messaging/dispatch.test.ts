import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { dispatchMessages, submitReservationBatches, type DispatchMessagesInput } from "./dispatch";
import { PopbillSubmitError, PopbillTimeoutError, type MessageBatchInput } from "@/lib/popbill/types";

function makeClient(
  handlers: Record<string, (args: Record<string, unknown>) => unknown>,
  smsSender: string | null = null,
) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: smsSender ? { sms_sender: smsSender } : null,
    error: null,
  });
  return {
    rpc: vi.fn((fn: string, args: Record<string, unknown>) =>
      Promise.resolve({ data: handlers[fn] ? handlers[fn](args) : null, error: null }),
    ),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
    })),
  };
}

beforeAll(() => {
  vi.stubEnv("POPBILL_LINK_ID", "test-link");
  vi.stubEnv("POPBILL_SECRET_KEY", "test-secret");
  vi.stubEnv("POPBILL_CORP_NUM", "1234567890");
  vi.stubEnv("POPBILL_SMS_SENDER", "0211112222");
});

afterAll(() => vi.unstubAllEnvs());

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
    const admin = makeClient(
      {
        reserve_message_points: () => twoSmsReserve,
        create_provider_dispatch_jobs: () => ({ ok: true }),
        mark_message_reservation_provider_pending: () => ({ ok: true, status: "provider_pending", accepted: 1 }),
      },
      "0233334444",
    );
    const submitBatch = vi.fn().mockResolvedValue({
      requestNum: "m5c0",
      receiptNum: "RCPT-1",
      product: "sms",
      recipients: [],
    });
    const out = await dispatchMessages(baseInput, { sb, admin, submitBatch, isConfigured: () => true });
    expect(out).toMatchObject({ ok: true, status: "queued", logId: 9, queuedCount: 2, reservedPoints: 2 });
    expect(submitBatch).toHaveBeenCalledTimes(1); // 두 sms는 한 배치
    expect(submitBatch.mock.calls[0][2]).toMatchObject({
      smsSender: "0233334444",
      kakaoSender: "",
    });
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

  it("submitReservationBatches: 알림톡 버튼 u1/u2를 수신자 변수로 각각 렌더링한다", async () => {
    const admin = makeClient({
      create_provider_dispatch_jobs: () => ({ ok: true }),
      mark_message_reservation_provider_pending: () => ({ ok: true, status: "provider_pending" }),
    });
    const captured: MessageBatchInput[] = [];
    const submitBatch = vi.fn(async (batch: MessageBatchInput) => {
      captured.push(batch);
      return { requestNum: batch.requestNum, receiptNum: "R", product: batch.product, recipients: [] };
    });
    const loadAlimtalkTemplate = vi.fn(async () => ({
      templateCode: "TPL_001",
      buttons: [
        {
          t: "WL",
          n: "상세보기",
          u1: "https://resident.example/r/#{상세토큰}",
          u2: "https://resident.example/desktop/#{상세토큰}/#{서명}",
        },
      ],
    }));

    await submitReservationBatches(
      admin,
      {
        reservationId: 6,
        scheduleId: null,
        body: "알림톡 본문",
        templateId: 17,
        resolved: [
          {
            phone: "010-1111-2222",
            name: "A",
            channel: "alimtalk",
            product: "alimtalk",
            renderedBody: "A님 안내",
            variables: { 상세토큰: "token-a", 서명: "sig-a" },
          },
          {
            phone: "010-3333-4444",
            name: "B",
            channel: "alimtalk",
            product: "alimtalk",
            renderedBody: "B님 안내",
            variables: { 상세토큰: "token-b", 서명: "sig-b" },
          },
        ],
        costs: [
          { recipient_key: "k1", product: "alimtalk" },
          { recipient_key: "k2", product: "alimtalk" },
        ],
      },
      { submitBatch, loadAlimtalkTemplate },
    );

    expect(loadAlimtalkTemplate).toHaveBeenCalledWith(17);
    expect(captured).toHaveLength(1);
    expect(captured[0].recipients.map((recipient) => recipient.buttons?.[0].u1)).toEqual([
      "https://resident.example/r/token-a",
      "https://resident.example/r/token-b",
    ]);
    expect(captured[0].recipients.map((recipient) => recipient.buttons?.[0].u2)).toEqual([
      "https://resident.example/desktop/token-a/sig-a",
      "https://resident.example/desktop/token-b/sig-b",
    ]);
    expect(JSON.stringify(captured[0].recipients)).not.toContain("#{");
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

function rpcNamesOf(admin: ReturnType<typeof makeClient>): string[] {
  return (admin.rpc as unknown as { mock: { calls: [string, unknown][] } }).mock.calls.map((c) => c[0]);
}

describe("dispatchMessages 예약 replay 상태별 처리", () => {
  function replayClientsFor(status: string) {
    const sb = makeClient({
      quote_message_points: () => ({ ok: true, rate_ids: { sms: 1 }, estimated_points: 2 }),
    });
    const admin = makeClient({
      reserve_message_points: () => ({
        ok: true,
        replayed: true,
        status,
        reservation_id: 5,
        message_log_id: 9,
        reserved_points: 2,
      }),
      create_provider_dispatch_jobs: () => ({ ok: true }),
      mark_message_reservation_provider_pending: () => ({ ok: true, status: "provider_pending" }),
    });
    const submitBatch = vi.fn();
    return { sb, admin, submitBatch };
  }

  it("reserved replay는 재접수 없이 SEND_IN_PROGRESS(409)를 반환하고 queued로 표기하지 않는다", async () => {
    const { sb, admin, submitBatch } = replayClientsFor("reserved");
    const out = await dispatchMessages(baseInput, { sb, admin, submitBatch, isConfigured: () => true });
    expect(out).toMatchObject({ ok: false, code: "SEND_IN_PROGRESS", httpStatus: 409 });
    expect(out.status).toBeUndefined();
    expect(submitBatch).not.toHaveBeenCalled();
    const names = rpcNamesOf(admin);
    expect(names).not.toContain("create_provider_dispatch_jobs");
    expect(names).not.toContain("mark_message_reservation_provider_pending");
  });

  it("reconcile_required replay는 SEND_UNCONFIRMED(502)를 반환하고 queued로 표기하지 않는다", async () => {
    const { sb, admin, submitBatch } = replayClientsFor("reconcile_required");
    const out = await dispatchMessages(baseInput, { sb, admin, submitBatch, isConfigured: () => true });
    expect(out).toMatchObject({ ok: false, code: "SEND_UNCONFIRMED", httpStatus: 502 });
    expect(out.status).toBeUndefined();
    expect(submitBatch).not.toHaveBeenCalled();
    const names = rpcNamesOf(admin);
    expect(names).not.toContain("create_provider_dispatch_jobs");
    expect(names).not.toContain("mark_message_reservation_provider_pending");
  });

  it("provider_pending replay는 provider 재호출 없이 안전한 queued를 반환한다", async () => {
    const { sb, admin, submitBatch } = replayClientsFor("provider_pending");
    const out = await dispatchMessages(baseInput, { sb, admin, submitBatch, isConfigured: () => true });
    expect(out).toMatchObject({ ok: true, status: "queued", reservationId: 5 });
    expect(submitBatch).not.toHaveBeenCalled();
  });

  it("settled replay는 provider 재호출 없이 안전한 queued를 반환한다", async () => {
    const { sb, admin, submitBatch } = replayClientsFor("settled");
    const out = await dispatchMessages(baseInput, { sb, admin, submitBatch, isConfigured: () => true });
    expect(out).toMatchObject({ ok: true, status: "queued", reservationId: 5 });
    expect(submitBatch).not.toHaveBeenCalled();
  });

  it("최초 접수 중 동일 키 재요청(reserved replay)은 재접수하지 않아 submit/mark/create가 정확히 1회다", async () => {
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
              status: "reserved",
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
    expect(second).toMatchObject({ ok: false, code: "SEND_IN_PROGRESS", httpStatus: 409 });
    expect(submitBatch).toHaveBeenCalledTimes(1);
    const names = rpcNamesOf(admin);
    expect(names.filter((n) => n === "mark_message_reservation_provider_pending")).toHaveLength(1);
    expect(names.filter((n) => n === "create_provider_dispatch_jobs")).toHaveLength(1);
  });
});

describe("dispatchMessages 서버 페이로드 해시(material 필드 전체)", () => {
  async function hashFor(input: DispatchMessagesInput): Promise<string> {
    let hash = "";
    const sb = makeClient({
      quote_message_points: () => ({ ok: true, rate_ids: { sms: 1 }, estimated_points: 2 }),
    });
    const admin = makeClient({
      reserve_message_points: (args) => {
        hash = String(args.p_payload_hash ?? "");
        return twoSmsReserve;
      },
      create_provider_dispatch_jobs: () => ({ ok: true }),
      mark_message_reservation_provider_pending: () => ({ ok: true, status: "provider_pending" }),
    });
    const submitBatch = vi.fn().mockResolvedValue({ requestNum: "m5c0", receiptNum: "R", product: "sms", recipients: [] });
    await dispatchMessages(input, { sb, admin, submitBatch, isConfigured: () => true });
    return hash;
  }

  it("동일 material 필드는 동일 해시다", async () => {
    expect(await hashFor(baseInput)).toBe(await hashFor({ ...baseInput }));
  });

  it("context가 다르면 페이로드 해시가 다르다", async () => {
    expect(await hashFor(baseInput)).not.toBe(await hashFor({ ...baseInput, context: "고지서" }));
  });

  it("effective templateId가 다르면 페이로드 해시가 다르다", async () => {
    expect(await hashFor({ ...baseInput, mode: "auto", templateId: null })).not.toBe(
      await hashFor({ ...baseInput, mode: "auto", templateId: 5 }),
    );
  });

  it("수신자 identity(ref)가 다르면 전화/본문이 같아도 페이로드 해시가 다르다", async () => {
    const a = {
      ...baseInput,
      recipients: [{ name: "A", phone: "010-1111-2222", kind: "tenant" as const, ref: { occupancyId: 1 } }],
    };
    const b = {
      ...baseInput,
      recipients: [{ name: "A", phone: "010-1111-2222", kind: "tenant" as const, ref: { occupancyId: 2 } }],
    };
    expect(await hashFor(a)).not.toBe(await hashFor(b));
  });
});
