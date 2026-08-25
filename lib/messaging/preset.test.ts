import { describe, expect, it } from "vitest";
import {
  buildRecipientRenderVariables,
  buildSendPayload,
  dedupeRecipients,
  type MessageProduct,
  type MessageRecipient,
  type MessagingPreset,
  type SendMode,
  validRecipients,
} from "./preset";
import { hasUnresolvedVariables, renderTemplate } from "./render";

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

describe("buildRecipientRenderVariables", () => {
  it("수신자별 변수를 서로 다른 본문으로 렌더하고 모든 변수를 치환한다", () => {
    const body =
      "#{이름} #{호수} #{호실} #{건물명} 청구금액 #{청구금액}원, #{세대}";
    const preset: MessagingPreset = {
      context: "고지서",
      commonVariables: {
        건물명: "공통 건물",
        청구금액: "공통 금액",
      },
    };
    const recipientsWithVariables: MessageRecipient[] = [
      {
        name: "홍길동",
        phone: "01011112222",
        unitNo: "1001",
        kind: "tenant",
        variables: {
          건물명: "수신자 건물",
          청구금액: "120,000",
          세대: "101동 1001호",
        },
      },
      {
        name: "김철수",
        phone: "01033334444",
        unitNo: "1002",
        kind: "tenant",
        variables: {
          건물명: "수신자 건물",
          청구금액: "98,000",
          세대: "101동 1002호",
        },
      },
    ];

    const renderedBodies = recipientsWithVariables.map((recipient) =>
      renderTemplate(
        body,
        buildRecipientRenderVariables(
          recipient,
          preset.commonVariables,
          "기본 건물",
        ),
      ),
    );

    expect(renderedBodies[0]).toContain("120,000");
    expect(renderedBodies[0]).toContain("101동 1001호");
    expect(renderedBodies[1]).toContain("98,000");
    expect(renderedBodies[1]).toContain("101동 1002호");
    expect(renderedBodies).toEqual([
      "홍길동 1001 1001 수신자 건물 청구금액 120,000원, 101동 1001호",
      "김철수 1002 1002 수신자 건물 청구금액 98,000원, 101동 1002호",
    ]);
    expect(renderedBodies.every((rendered) => !hasUnresolvedVariables(rendered)))
      .toBe(true);
  });

  it("수신자 변수 > 공통 변수 > 기본 변수 순서로 병합한다", () => {
    expect(
      buildRecipientRenderVariables(
        {
          name: "기본 이름",
          phone: "01011112222",
          unitNo: "1001",
          kind: "tenant",
          variables: { 이름: "수신자 이름", 청구금액: "120,000" },
        },
        { 이름: "공통 이름", 호수: "공통 호수", 청구금액: "98,000" },
        "기본 건물",
      ),
    ).toMatchObject({
      이름: "수신자 이름",
      호수: "공통 호수",
      호실: "1001",
      건물명: "기본 건물",
      청구금액: "120,000",
    });
  });
});
