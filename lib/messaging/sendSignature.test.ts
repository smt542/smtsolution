import { describe, expect, it } from "vitest";
import { canonicalSendPayload, type SendSignatureFields } from "./sendSignature";

const base: SendSignatureFields = {
  mode: "sms",
  body: "본문",
  context: "manual",
  templateId: null,
  recipients: [
    {
      kind: "tenant",
      name: "김입주",
      phone: "010-1000-0000",
      unitNo: "101호",
      ref: { occupancyId: 101 },
      channel: "sms",
      renderedBody: "본문",
    },
  ],
};

describe("canonicalSendPayload", () => {
  it("동일한 material 필드는 동일한 서명을 만든다", () => {
    expect(canonicalSendPayload(base)).toBe(
      canonicalSendPayload(JSON.parse(JSON.stringify(base))),
    );
  });

  it("mode 변경은 서명을 바꾼다", () => {
    expect(canonicalSendPayload({ ...base, mode: "alimtalk" })).not.toBe(
      canonicalSendPayload(base),
    );
  });

  it("body 변경은 서명을 바꾼다", () => {
    expect(canonicalSendPayload({ ...base, body: "다른본문" })).not.toBe(
      canonicalSendPayload(base),
    );
  });

  it("context 변경은 서명을 바꾼다", () => {
    expect(canonicalSendPayload({ ...base, context: "고지서" })).not.toBe(
      canonicalSendPayload(base),
    );
  });

  it("effective templateId 변경은 서명을 바꾼다", () => {
    expect(canonicalSendPayload({ ...base, templateId: 5 })).not.toBe(
      canonicalSendPayload(base),
    );
  });

  it("수신자 identity(ref) 변경은 전화/채널/본문이 같아도 서명을 바꾼다", () => {
    const changed: SendSignatureFields = {
      ...base,
      recipients: [{ ...base.recipients[0], ref: { occupancyId: 999 } }],
    };
    expect(canonicalSendPayload(changed)).not.toBe(canonicalSendPayload(base));
  });

  it("수신자 phone 변경은 서명을 바꾼다", () => {
    const changed: SendSignatureFields = {
      ...base,
      recipients: [{ ...base.recipients[0], phone: "010-2000-0000" }],
    };
    expect(canonicalSendPayload(changed)).not.toBe(canonicalSendPayload(base));
  });

  it("수신자 renderedBody 변경은 서명을 바꾼다", () => {
    const changed: SendSignatureFields = {
      ...base,
      recipients: [{ ...base.recipients[0], renderedBody: "개인화 본문" }],
    };
    expect(canonicalSendPayload(changed)).not.toBe(canonicalSendPayload(base));
  });

  it("수신자 kind 변경은 서명을 바꾼다", () => {
    const changed: SendSignatureFields = {
      ...base,
      recipients: [{ ...base.recipients[0], kind: "owner" }],
    };
    expect(canonicalSendPayload(changed)).not.toBe(canonicalSendPayload(base));
  });
});
