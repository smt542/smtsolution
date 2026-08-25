import type { PopbillKakaoButton } from "popbill";

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
  /** 이미 조회한 입주자 동의값. 없으면 composer가 occupancyId로 다시 조회한다. */
  alimtalkOptIn?: boolean;
  phoneType?: "primary" | "secondary";
  unitNo?: string | null;
  kind: "tenant" | "owner" | "staff" | "vendor" | "etc";
  variables?: Record<string, string>;
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
  commonVariables?: Record<string, string>;
  /** 예약 발송 초기값(ISO 8601). 지정되면 composer가 예약 발송으로 열린다. */
  scheduledAt?: string;
}

/**
 * 템플릿 기본값과 공통·수신자별 변수를 발송 렌더 우선순위로 병합한다.
 * `호실`은 기존 수동 템플릿 호환용 별칭이며 `호수`와 같은 기본값을 쓴다.
 */
export function buildRecipientRenderVariables(
  recipient: MessageRecipient,
  commonVariables: Record<string, string> | undefined,
  buildingName: string | null | undefined,
): Record<string, string> {
  return {
    이름: recipient.name ?? "",
    호수: recipient.unitNo ?? "",
    호실: recipient.unitNo ?? "",
    건물명: buildingName ?? "",
    ...(commonVariables ?? {}),
    ...(recipient.variables ?? {}),
  };
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
  renderedButtons?: PopbillKakaoButton[];
}
