import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc }),
}));

import { listMessageLogs, sendMessages } from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("messaging apis", () => {
  it("sendMessages: calls send_messages with snake-case arguments", async () => {
    const recipients = [
      {
        name: "Kim",
        phone: "010-1234-5678",
        unitNo: "101",
        kind: "tenant" as const,
        ref: { occupancyId: 9 },
      },
    ];
    rpc.mockResolvedValue({ data: { log_id: 17, count: 1 }, error: null });

    const result = await sendMessages({
      channel: "sms",
      body: "Payment reminder",
      context: "overdue",
      recipients,
    });

    expect(rpc).toHaveBeenCalledWith("send_messages", {
      p_channel: "sms",
      p_body: "Payment reminder",
      p_context: "overdue",
      p_recipients: recipients,
    });
    expect(result).toEqual({ logId: 17, count: 1 });
  });

  it("listMessageLogs: maps snake-case rows and recipients to camel case", async () => {
    const recipients = [
      {
        name: "Lee",
        phone: "010-9876-5432",
        unitNo: "202",
        kind: "owner",
        ref: { buildingId: 4 },
        result: "stub",
      },
    ];
    rpc.mockResolvedValue({
      data: [
        {
          id: 21,
          org_id: 3,
          channel: "sms",
          body: "Notice",
          context: "manual",
          recipient_count: 1,
          recipients,
          result: "stub",
          sent_by: "user-1",
          sent_at: "2026-08-13T01:02:03.000Z",
        },
      ],
      error: null,
    });

    const result = await listMessageLogs(25);

    expect(rpc).toHaveBeenCalledWith("list_message_logs", { p_limit: 25 });
    expect(result).toEqual([
      {
        id: 21,
        orgId: 3,
        channel: "sms",
        body: "Notice",
        context: "manual",
        recipientCount: 1,
        recipients,
        result: "stub",
        sentBy: "user-1",
        sentAt: "2026-08-13T01:02:03.000Z",
      },
    ]);
  });

  it("throws RPC errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden" } });

    await expect(listMessageLogs()).rejects.toThrow("forbidden");
  });
});
