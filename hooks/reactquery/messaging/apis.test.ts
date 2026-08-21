import { describe, it, expect, vi, beforeEach } from "vitest";
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
import {
  MessagePointQuoteError,
  MessageSendError,
  cancelScheduledMessage,
  listMessageLogs,
  listTenantAlimtalkConsent,
  quoteMessagePoints,
  sendMessages,
} from "./apis";
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("messaging apis (P4b)", () => {
  it("sendMessages: 즉시발송은 /api/messaging/send 라우트로 POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        billingMode: "live", messageLogId: 7, result: "sent", chargedPoints: 2,
        recipients: [{ status: "success" }, { status: "success" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const out = await sendMessages({
      mode: "auto", body: "#{이름}님", context: "manual", templateId: 5,
      recipients: [
        { name: "A", phone: "0101", kind: "tenant", channel: "alimtalk", renderedBody: "A님", ref: { occupancyId: 11 } },
        { name: "B", phone: "0102", kind: "owner", channel: "sms", renderedBody: "B님" },
      ],
    });
    expect(out).toMatchObject({
      logId: 7, status: "sent", scheduledAt: null, billingMode: "live", sendResult: "sent", chargedPoints: 2,
    });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/messaging/send");
    expect(opts.method).toBe("POST");
    const sent = JSON.parse(opts.body);
    expect(sent).toMatchObject({ mode: "auto", body: "#{이름}님", context: "manual", templateId: 5 });
    expect(sent.recipients).toHaveLength(2);
  });
  it("예약 발송 등록과 취소 RPC를 호출", async () => {
    rpc.mockResolvedValueOnce({
      data: { schedule_id: 8, count: 1, scheduled_at: "2026-08-20T00:30:00Z" }, error: null,
    });
    const recipients = [{ name:"A", phone:"1", kind:"tenant" as const, channel:"sms" as const, renderedBody:"x" }];
    const out = await sendMessages({
      mode: "sms", body: "x", context: "고지서", templateId: null, recipients,
      scheduledAt: "2026-08-20T00:30:00Z",
    });
    expect(out).toMatchObject({ logId: 8, count: 1, status: "scheduled", scheduledAt: "2026-08-20T00:30:00Z" });
    expect(rpc).toHaveBeenCalledWith("schedule_messages", expect.objectContaining({ p_scheduled_at: "2026-08-20T00:30:00Z" }));

    rpc.mockResolvedValueOnce({ data: null, error: null });
    await cancelScheduledMessage(8);
    expect(rpc).toHaveBeenLastCalledWith("cancel_scheduled_message", { p_schedule_id: 8 });
  });
  it("listTenantAlimtalkConsent: rpc·snake→camel", async () => {
    rpc.mockResolvedValue({ data: [{ occupancy_id: 11, alimtalk_opt_in: true, sms_opt_in: false }], error: null });
    const r = await listTenantAlimtalkConsent(3);
    expect(rpc).toHaveBeenCalledWith("list_tenant_alimtalk_consent", { p_building_id: 3 });
    expect(r[0]).toEqual({ occupancyId: 11, alimtalkOptIn: true, smsOptIn: false });
  });
  it("sendMessages: 라우트 오류 코드 전파(포인트 부족 등)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 402,
      json: async () => ({ error: "INSUFFICIENT_POINTS", required_points: 5, available_points: 0 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const promise = sendMessages({ mode: "sms", body: "x", context: "manual", templateId: null, recipients: [{ name: "A", phone: "1", kind: "tenant", channel: "sms", renderedBody: "x" }] });
    await expect(promise).rejects.toBeInstanceOf(MessageSendError);
    await expect(promise).rejects.toMatchObject({ code: "INSUFFICIENT_POINTS" });
  });

  it("quoteMessagePoints: RPC 응답을 camelCase로 변환한다", async () => {
    rpc.mockResolvedValue({
      data: {
        ok: true,
        counts: { total: 3, sms: 2, alimtalk: 1 },
        excluded_count: 1,
        rate_snapshot: {
          sms: { id: 8, points: 1 },
          alimtalk: { id: 9, points: 2 },
        },
        ledger_balance: 100,
        reserved_points: 10,
        available_points: 90,
        estimated_points: 4,
        sufficient: true,
        billing_mode: "stub",
      },
      error: null,
    });

    const input = {
      mode: "auto" as const,
      recipients: [{ name: "A", phone: "0101", kind: "tenant" as const }],
      templateId: 5,
    };
    await expect(quoteMessagePoints(input)).resolves.toEqual({
      recipientCount: 3,
      excludedCount: 1,
      channelCounts: { sms: 2, alimtalk: 1 },
      rateSnapshot: {
        sms: { rateId: 8, points: 1 },
        alimtalk: { rateId: 9, points: 2 },
      },
      ledgerBalance: 100,
      reservedPoints: 10,
      availablePoints: 90,
      estimatedPoints: 4,
      sufficient: true,
      billingMode: "stub",
    });
    expect(rpc).toHaveBeenCalledWith("quote_message_points", {
      p_mode: "auto",
      p_recipients: input.recipients,
      p_template_id: 5,
    });
  });

  it("quoteMessagePoints: 구조화 오류 코드를 보존한다", async () => {
    rpc.mockResolvedValue({
      data: { ok: false, code: "RATE_NOT_CONFIGURED", message: "단가 없음" },
      error: null,
    });

    const promise = quoteMessagePoints({
      mode: "sms",
      recipients: [{ name: "A", phone: "0101", kind: "tenant" }],
      templateId: null,
    });
    await expect(promise).rejects.toBeInstanceOf(MessagePointQuoteError);
    await expect(promise).rejects.toMatchObject({ code: "RATE_NOT_CONFIGURED" });
  });

  it("listMessageLogs: 포인트 상태를 매핑한다", async () => {
    rpc.mockResolvedValue({
      data: [{
        id: 1,
        org_id: 2,
        channel: "sms",
        body: "안내",
        context: "manual",
        recipient_count: 2,
        recipients: [],
        result: "stub",
        sent_by: null,
        sent_at: "2026-08-18T00:00:00Z",
        template_id: null,
        estimated_points: 2,
        charged_points: 0,
        point_status: "quoted",
      }],
      error: null,
    });

    await expect(listMessageLogs()).resolves.toEqual([
      expect.objectContaining({ estimatedPoints: 2, chargedPoints: 0, pointStatus: "quoted" }),
    ]);
  });
});
