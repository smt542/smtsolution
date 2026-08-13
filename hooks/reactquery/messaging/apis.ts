import { createClient } from "@/lib/supabase/client";
import type {
  MessageChannel,
  MessageRecipient,
} from "@/lib/messaging/preset";

export interface MessageLog {
  id: number;
  orgId: number;
  channel: MessageChannel;
  body: string;
  context: string;
  recipientCount: number;
  recipients: MessageRecipient[];
  result: string;
  sentBy: string | null;
  sentAt: string;
}

export interface SendMessagesInput {
  channel: MessageChannel;
  body: string;
  context: string;
  recipients: MessageRecipient[];
}

type MessageLogRow = {
  id: number;
  org_id: number;
  channel: MessageChannel;
  body: string;
  context: string;
  recipient_count: number;
  recipients: MessageRecipient[];
  result: string;
  sent_by: string | null;
  sent_at: string;
};

const rowToMessageLog = (row: MessageLogRow): MessageLog => ({
  id: row.id,
  orgId: row.org_id,
  channel: row.channel,
  body: row.body,
  context: row.context,
  recipientCount: row.recipient_count,
  recipients: row.recipients,
  result: row.result,
  sentBy: row.sent_by,
  sentAt: row.sent_at,
});

export async function sendMessages(
  input: SendMessagesInput,
): Promise<{ logId: number; count: number }> {
  const { data, error } = await createClient().rpc("send_messages", {
    p_channel: input.channel,
    p_body: input.body,
    p_context: input.context,
    p_recipients: input.recipients,
  });
  if (error) throw new Error(error.message);
  const result = data as { log_id: number; count: number };
  return { logId: result.log_id, count: result.count };
}

export async function listMessageLogs(limit?: number): Promise<MessageLog[]> {
  const { data, error } = await createClient().rpc("list_message_logs", {
    p_limit: limit ?? 50,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as MessageLogRow[]).map(rowToMessageLog);
}
