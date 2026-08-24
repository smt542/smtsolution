import { describe, expect, it } from "vitest";
import {
  buildSendPayload,
  dedupeRecipients,
  type MessageProduct,
  type MessageRecipient,
  type SendMode,
  validRecipients,
} from "./preset";

const recipients: MessageRecipient[] = [
  { name: "Tenant A", phone: "010-1111-2222", kind: "tenant" },
  { name: "Tenant B", phone: "01011112222", kind: "tenant" },
  { name: "Owner", phone: null, kind: "owner" },
  { name: "Staff", phone: null, kind: "staff" },
];

describe("dedupeRecipients", () => {
  it("collapses normalized duplicate phones and preserves every null-phone recipient", () => {
    expect(dedupeRecipients(recipients)).toEqual([
      recipients[0],
      recipients[2],
      recipients[3],
    ]);
  });
});

describe("validRecipients", () => {
  it("drops recipients whose phone is null or empty", () => {
    const input: MessageRecipient[] = [
      ...recipients,
      { name: "Vendor", phone: "", kind: "vendor" },
      { name: "Etc", phone: "---", kind: "etc" },
    ];

    expect(validRecipients(input)).toEqual([recipients[0], recipients[1]]);
  });
});

describe("buildSendPayload", () => {
  it("dedupes and validates recipients while preserving the given context", () => {
    const payload = buildSendPayload({
      channel: "sms",
      body: "Payment reminder",
      context: "overdue",
      recipients: [
        ...recipients,
        { name: "Vendor", phone: "", kind: "vendor" },
      ],
    });

    expect(payload).toEqual({
      channel: "sms",
      body: "Payment reminder",
      context: "overdue",
      recipients: [recipients[0]],
    });
  });
});

describe("preset SendMode/채널 확장", () => {
  it("SendMode 타입이 auto/sms/alimtalk 허용", () => {
    const modes: SendMode[] = ["auto", "sms", "alimtalk"];
    expect(modes).toHaveLength(3);
  });
  it("buildSendPayload: 유효 수신처만·중복 제거는 유지", () => {
    const out = buildSendPayload({
      channel: "sms",
      body: "본문",
      context: "manual",
      recipients: [
        { name: "A", phone: "010-1", kind: "tenant" },
        { name: "A2", phone: "0101", kind: "tenant" },
        { name: "B", phone: null, kind: "owner" },
      ],
    });
    expect(out.recipients).toHaveLength(1);
  });
  it("MessageProduct 타입은 과금 제품 sms/lms/alimtalk를 포함한다", () => {
    const products: MessageProduct[] = ["sms", "lms", "alimtalk"];
    expect(products).toHaveLength(3);
  });
});
