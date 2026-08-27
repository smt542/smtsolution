import type { MessagePointQuoteInput } from "./apis";
import { canonicalSendPayload } from "@/lib/messaging/sendSignature";

const pointQuoteSignatures = new WeakMap<MessagePointQuoteInput, string>();

function compactHash(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${value.length.toString(36)}:${(first >>> 0).toString(36)}:${(second >>> 0).toString(36)}`;
}

function pointQuoteSignature(input: MessagePointQuoteInput): string {
  const cached = pointQuoteSignatures.get(input);
  if (cached) return cached;

  const signature = compactHash(canonicalSendPayload({
    mode: input.mode,
    body: input.body ?? "",
    context: "point-quote",
    templateId: input.templateId,
    recipients: input.recipients,
  }));
  pointQuoteSignatures.set(input, signature);
  return signature;
}

export const messagingKeys = {
  all: ["messaging"] as const,
  logs: (limit?: number) => ["messaging", "logs", limit] as const,
  consent: (buildingId: number) => ["messaging", "consent", buildingId] as const,
  pointQuote: (input: MessagePointQuoteInput | null) =>
    ["messaging", "point-quote", input === null ? null : pointQuoteSignature(input)] as const,
};
