import { createClient } from "@/lib/supabase/client";
import type {
  MessageRecipient,
  ResolvedRecipient,
  SendMode,
} from "@/lib/messaging/preset";

export interface MessageLog {
  id: number;
  orgId: number;
  channel: SendMode;
  body: string;
  context: string;
  recipientCount: number;
  recipients: MessageRecipient[];
  result: string;
  sentBy: string | null;
  sentAt: string;
  templateId: number | null;
}

export interface SendMessagesInput {
  mode: SendMode;
  body: string;
  context: string;
  templateId: number | null;
  recipients: ResolvedRecipient[];
  scheduledAt?: string | null;
}

export interface SendMessagesResult {
  logId: number;
  count: number;
  status: "sent" | "scheduled";
  scheduledAt: string | null;
  recipients: ResolvedRecipient[];
}

type MessageLogRow = {
  id: number;
  org_id: number;
  channel: SendMode;
  body: string;
  context: string;
  recipient_count: number;
  recipients: MessageRecipient[];
  result: string;
  sent_by: string | null;
  sent_at: string;
  template_id: number | null;
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
  templateId: row.template_id,
});

export async function sendMessages(
  input: SendMessagesInput,
): Promise<SendMessagesResult> {
  if (input.scheduledAt) {
    const { data, error } = await createClient().rpc("schedule_messages", {
      p_channel: input.mode,
      p_body: input.body,
      p_context: input.context,
      p_recipients: input.recipients,
      p_template_id: input.templateId,
      p_scheduled_at: input.scheduledAt,
    });
    if (error) throw new Error(error.message);
    const result = data as { schedule_id: number; count: number; scheduled_at: string };
    return {
      logId: result.schedule_id,
      count: result.count,
      status: "scheduled",
      scheduledAt: result.scheduled_at,
      recipients: input.recipients,
    };
  }

  const { data, error } = await createClient().rpc("send_messages", {
    p_channel: input.mode,
    p_body: input.body,
    p_context: input.context,
    p_recipients: input.recipients,
    p_template_id: input.templateId,
  });
  if (error) throw new Error(error.message);
  const result = data as { log_id: number; count: number };
  return {
    logId: result.log_id,
    count: result.count,
    status: "sent",
    scheduledAt: null,
    recipients: input.recipients,
  };
}

export async function cancelScheduledMessage(scheduleId: number): Promise<void> {
  const { error } = await createClient().rpc("cancel_scheduled_message", {
    p_schedule_id: scheduleId,
  });
  if (error) throw new Error(error.message);
}

export interface TenantConsent { occupancyId: number; alimtalkOptIn: boolean; smsOptIn: boolean; }
type TenantConsentRow = { occupancy_id: number; alimtalk_opt_in: boolean; sms_opt_in: boolean };

export async function listTenantAlimtalkConsent(buildingId: number): Promise<TenantConsent[]> {
  const { data, error } = await createClient().rpc("list_tenant_alimtalk_consent", { p_building_id: buildingId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as TenantConsentRow[]).map((r) => ({
    occupancyId: r.occupancy_id, alimtalkOptIn: r.alimtalk_opt_in, smsOptIn: r.sms_opt_in,
  }));
}

export async function listMessageLogs(limit?: number): Promise<MessageLog[]> {
  const { data, error } = await createClient().rpc("list_message_logs", {
    p_limit: limit ?? 50,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as MessageLogRow[]).map(rowToMessageLog);
}
