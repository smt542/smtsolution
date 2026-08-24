/**
 * 발송 멱등을 위한 **material 페이로드 정규화**(공급자 중립, 순수 함수).
 *
 * 클라이언트 초안 서명과 서버 페이로드 해시가 **동일한 실질 필드**를 담게 하는 단일 소스다.
 * 이 값이 바뀌면 논리적 발송 시도가 달라진 것이므로 클라이언트는 멱등 키를 회전하고, 서버는
 * 같은 키에 다른 해시가 오면 IDEMPOTENCY_CONFLICT로 막는다. 어느 한쪽이 필드를 빠뜨리면
 * (예: 수신자 identity/ref) 실제 발송 대상이 바뀌었는데도 stale 키를 재사용할 위험이 생긴다.
 *
 * material 필드: mode · body · context · (effective) templateId · **완전한 수신자**
 * (kind/name/phone/unitNo/ref/channel/renderedBody).
 */

export interface SendSignatureRecipient {
  kind?: string;
  name?: string | null;
  phone?: string | null;
  unitNo?: string | null;
  ref?: Record<string, unknown> | null;
  channel?: string | null;
  renderedBody?: string | null;
}

export interface SendSignatureFields {
  mode: string;
  body: string;
  context: string;
  /** effective templateId(프리셋 템플릿 반영 후). SMS 경로에서는 null이 정상이다. */
  templateId: number | null;
  recipients: SendSignatureRecipient[];
}

/** material 필드를 순서 안정적인 정규 문자열로 직렬화한다. 클라이언트 서명·서버 해시 공용. */
export function canonicalSendPayload(fields: SendSignatureFields): string {
  return JSON.stringify({
    mode: fields.mode,
    body: fields.body,
    context: fields.context,
    templateId: fields.templateId ?? null,
    recipients: fields.recipients.map((recipient) => ({
      kind: recipient.kind ?? null,
      name: recipient.name ?? null,
      phone: recipient.phone ?? null,
      unitNo: recipient.unitNo ?? null,
      ref: recipient.ref ?? null,
      channel: recipient.channel ?? null,
      body: recipient.renderedBody ?? null,
    })),
  });
}
