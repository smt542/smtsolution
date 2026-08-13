import { describe, expect, it } from "vitest";
import {
  buildSendPayload,
  dedupeRecipients,
  type MessageRecipient,
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
