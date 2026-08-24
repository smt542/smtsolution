export type MessageChannel = "sms" | "alimtalk";
export type SendMode = "auto" | "sms" | "alimtalk";
/**
 * 실제 과금 제품. UI 라우팅용 MessageChannel(sms|alimtalk)과 구분한다.
 * lms는 사용자가 선택하는 채널이 아니라 렌더된 본문이 SMS 한도를 넘으면 자동 승격되는 제품이다.
 */
export type MessageProduct = "sms" | "lms" | "alimtalk";

export interface MessageRecipient {
  name: string | null;
  phone: string | null;
  phoneType?: "primary" | "secondary";
  unitNo?: string | null;
  kind: "tenant" | "owner" | "staff" | "vendor" | "etc";
  ref?: {
    occupancyId?: number;
    unitId?: number;
    buildingId?: number;
    userId?: string;
  };
}

export interface MessagingPreset {
  context: string;
  buildingId?: number;
  channel?: MessageChannel;
  mode?: SendMode;
  templateId?: number | null;
  templateTitle?: string;
  body?: string;
  recipients?: MessageRecipient[];
}

interface SendPayload {
  channel: MessageChannel;
  body: string;
  context: string;
  recipients: MessageRecipient[];
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function dedupeRecipients(
  recipients: MessageRecipient[],
): MessageRecipient[] {
  const seenPhones = new Set<string>();

  return recipients.filter((recipient) => {
    if (recipient.phone === null) {
      return true;
    }

    const normalizedPhone = normalizePhone(recipient.phone);
    if (seenPhones.has(normalizedPhone)) {
      return false;
    }

    seenPhones.add(normalizedPhone);
    return true;
  });
}

export function validRecipients(
  recipients: MessageRecipient[],
): MessageRecipient[] {
  return recipients.filter(
    (recipient): recipient is MessageRecipient & { phone: string } =>
      recipient.phone !== null && normalizePhone(recipient.phone).length > 0,
  );
}

export function buildSendPayload(payload: SendPayload): SendPayload {
  return {
    ...payload,
    recipients: validRecipients(dedupeRecipients(payload.recipients)),
  };
}

export interface ResolvedRecipient extends MessageRecipient {
  channel: MessageChannel;
  renderedBody: string;
}
