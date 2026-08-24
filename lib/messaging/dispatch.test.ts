import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./ncp", () => ({
  isNcpConfigured: vi.fn(),
  sendSmsViaNcp: vi.fn(),
}));
vi.mock("./alimtalk", () => ({
  isAlimtalkConfigured: vi.fn(),
  sendAlimtalkViaNcp: vi.fn(),
}));

import { anyChannelConfigured, dispatchMessages, dispatchOne } from "./dispatch";
import { isNcpConfigured, sendSmsViaNcp } from "./ncp";
import { isAlimtalkConfigured, sendAlimtalkViaNcp } from "./alimtalk";
import { PopbillSubmitError } from "@/lib/popbill/types";

afterEach(() => vi.clearAllMocks());

describe("anyChannelConfigured", () => {
  it("sms: NCP 설정 여부를 따른다", () => {
    vi.mocked(isNcpConfigured).mockReturnValue(true);
    vi.mocked(isAlimtalkConfigured).mockReturnValue(false);
    expect(anyChannelConfigured("sms")).toBe(true);
  });
  it("alimtalk: 알림톡 설정 여부를 따른다", () => {
    vi.mocked(isNcpConfigured).mockReturnValue(false);
    vi.mocked(isAlimtalkConfigured).mockReturnValue(false);
    expect(anyChannelConfigured("alimtalk")).toBe(false);
  });
  it("auto: 둘 중 하나라도 설정되면 true", () => {
    vi.mocked(isNcpConfigured).mockReturnValue(false);
    vi.mocked(isAlimtalkConfigured).mockReturnValue(true);
    expect(anyChannelConfigured("auto")).toBe(true);
  });
});

describe("dispatchOne", () => {
  it("sms 설정+성공 → success", async () => {
    vi.mocked(isNcpConfigured).mockReturnValue(true);
    vi.mocked(sendSmsViaNcp).mockResolvedValue({ requestId: "r1", statusCode: "202", ok: true });
    const r = await dispatchOne({ channel: "sms", phone: "01012345678", body: "hi" });
    expect(r.status).toBe("success");
    expect(r.providerId).toBe("r1");
    expect(sendSmsViaNcp).toHaveBeenCalledWith({ to: "01012345678", content: "hi" });
  });

  it("sms 미설정 → failed(unconfigured), 어댑터 미호출", async () => {
    vi.mocked(isNcpConfigured).mockReturnValue(false);
    const r = await dispatchOne({ channel: "sms", phone: "01012345678", body: "hi" });
    expect(r).toMatchObject({ status: "failed", reason: "unconfigured" });
    expect(sendSmsViaNcp).not.toHaveBeenCalled();
  });

  it("alimtalk 설정+성공 → success(templateCode·buttons 전달)", async () => {
    vi.mocked(isAlimtalkConfigured).mockReturnValue(true);
    vi.mocked(sendAlimtalkViaNcp).mockResolvedValue({ requestId: "a1", statusCode: "202", ok: true });
    const r = await dispatchOne({
      channel: "alimtalk", phone: "01012345678", body: "안녕",
      templateCode: "T1", buttons: [{ name: "확인", type: "WL", url: "https://x" }],
    });
    expect(r.status).toBe("success");
    expect(sendAlimtalkViaNcp).toHaveBeenCalledWith({
      to: "01012345678", templateCode: "T1", content: "안녕",
      buttons: [{ name: "확인", type: "WL", url: "https://x" }],
    });
  });

  it("alimtalk 미설정 → failed(unconfigured)", async () => {
    vi.mocked(isAlimtalkConfigured).mockReturnValue(false);
    const r = await dispatchOne({ channel: "alimtalk", phone: "01012345678", body: "hi", templateCode: "T1" });
    expect(r).toMatchObject({ status: "failed", reason: "unconfigured" });
  });

  it("alimtalk 설정+템플릿코드 없음 → failed(no_template_code)", async () => {
    vi.mocked(isAlimtalkConfigured).mockReturnValue(true);
    const r = await dispatchOne({ channel: "alimtalk", phone: "01012345678", body: "hi" });
    expect(r).toMatchObject({ status: "failed", reason: "no_template_code" });
    expect(sendAlimtalkViaNcp).not.toHaveBeenCalled();
  });

  it("어댑터 예외 → failed(reason 포함)", async () => {
    vi.mocked(isNcpConfigured).mockReturnValue(true);
    vi.mocked(sendSmsViaNcp).mockRejectedValue(new Error("network down"));
    const r = await dispatchOne({ channel: "sms", phone: "01012345678", body: "hi" });
    expect(r.status).toBe("failed");
    expect(r.reason).toContain("network down");
  });

  it("어댑터 ok:false → failed", async () => {
    vi.mocked(isNcpConfigured).mockReturnValue(true);
    vi.mocked(sendSmsViaNcp).mockResolvedValue({ requestId: null, statusCode: "400", ok: false });
    const r = await dispatchOne({ channel: "sms", phone: "01012345678", body: "hi" });
    expect(r.status).toBe("failed");
  });
});

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
