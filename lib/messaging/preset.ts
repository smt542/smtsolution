export type MessageChannel = "sms";

export interface MessageRecipient {
  name: string | null;
  phone: string | null;
  unitNo?: string | null;
  kind: "tenant" | "owner" | "staff" | "vendor" | "etc";
  ref?: {
    occupancyId?: number;
    buildingId?: number;
    userId?: string;
  };
}

export interface MessagingPreset {
  context: string;
  channel?: MessageChannel;
  body?: string;
  recipients?: MessageRecipient[];
}

interface SendPayload {
  channel: MessageChannel;
  body: string;
  context: string;
  recipients: MessageRecipient[];
}

export function dedupeRecipients(
  recipients: MessageRecipient[],
): MessageRecipient[] {
  const seenPhones = new Set<string>();

  return recipients.filter((recipient) => {
    if (recipient.phone === null) {
      return true;
    }

    if (seenPhones.has(recipient.phone)) {
      return false;
    }

    seenPhones.add(recipient.phone);
    return true;
  });
}

export function validRecipients(
  recipients: MessageRecipient[],
): MessageRecipient[] {
  return recipients.filter(
    (recipient): recipient is MessageRecipient & { phone: string } =>
      recipient.phone !== null && recipient.phone !== "",
  );
}

export function buildSendPayload(payload: SendPayload): SendPayload {
  return {
    ...payload,
    recipients: validRecipients(dedupeRecipients(payload.recipients)),
  };
}
