import type { MessageRecipient, SendMode } from "@/lib/messaging/preset";
import { formatPhone } from "@/lib/format";

export function formatMessageDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
}

export function channelLabel(channel: SendMode): string {
  return channel === "alimtalk" ? "알림톡" : "문자";
}

export function senderLabel(
  channel: SendMode,
  smsSender: string | null | undefined,
): string {
  if (channel === "alimtalk") return "관리비서 채널";
  return smsSender ? formatPhone(smsSender) : "발신번호 미등록";
}

export function recipientKindLabel(kind: MessageRecipient["kind"]): string {
  const labels: Record<MessageRecipient["kind"], string> = {
    tenant: "입주자",
    owner: "건물주",
    staff: "직원",
    cleaner: "청소 담당자",
    vendor: "협력업체",
    etc: "기타",
  };
  return labels[kind];
}

export function buildRecipientSummary(
  recipients: MessageRecipient[],
  recipientCount: number,
  buildingNameById: Map<number, string> | ReadonlyMap<number, string>,
): string {
  if (recipients.length === 0) return `${recipientCount}명`;

  const kinds = new Set(recipients.map((recipient) => recipient.kind));
  const kindLabel = kinds.size === 1
    ? recipientKindLabel(recipients[0].kind)
    : "수신자";

  const buildingIds = new Set(
    recipients
      .map((recipient) => recipient.ref?.buildingId)
      .filter((buildingId): buildingId is number => typeof buildingId === "number"),
  );
  const buildingId = buildingIds.size === 1 ? [...buildingIds][0] : undefined;
  const buildingName = buildingId === undefined ? undefined : buildingNameById.get(buildingId);
  const buildingLabel = buildingName ?? "전체";

  return `${kindLabel} / ${buildingLabel} / ${recipientCount}명`;
}

export function truncateBody(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  return normalized.length > 35 ? `${normalized.slice(0, 35)}…` : normalized;
}

/** 공용 Badge 의 tone 키 중 발송 결과가 쓰는 부분집합. */
export type MessageResultTone = "green" | "red" | "amber" | "gray";

export interface MessageResultMeta {
  label: string;
  tone: MessageResultTone;
}

/** message_logs.result 제약값(stub|queued|sent|partial|failed) 별 표기. */
export const MESSAGE_RESULT_META = {
  sent: { label: "완료", tone: "green" },
  failed: { label: "실패", tone: "red" },
  partial: { label: "일부 실패", tone: "amber" },
  queued: { label: "발송 중", tone: "gray" },
  stub: { label: "테스트", tone: "gray" },
} as const satisfies Record<string, MessageResultMeta>;

export function messageResultMeta(result: string): MessageResultMeta {
  return MESSAGE_RESULT_META[result as keyof typeof MESSAGE_RESULT_META] ?? {
    label: result,
    tone: "gray",
  };
}
