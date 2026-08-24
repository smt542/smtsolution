import { describe, expect, it } from "vitest";
import {
  buildSubmissionPlan,
  makeProviderRef,
  makeRequestNum,
  type PlanRecipient,
} from "./submission";

const ALNUM = /^[A-Za-z0-9]+$/;

describe("makeProviderRef", () => {
  it("결정적이고 20자 이하의 영숫자 키를 만든다", () => {
    const a = makeProviderRef(0, "phone-hash-abc");
    const b = makeProviderRef(0, "phone-hash-abc");
    expect(a).toBe(b);
    expect(a.length).toBeLessThanOrEqual(20);
    expect(a).toMatch(ALNUM);
  });
  it("같은 배치 내 서로 다른 인덱스는 다른 키를 만든다", () => {
    expect(makeProviderRef(0, "k")).not.toBe(makeProviderRef(1, "k"));
  });
});

describe("makeRequestNum", () => {
  it("결정적이고 36자 이하다", () => {
    const a = makeRequestNum("m", 12345, 0);
    expect(a).toBe(makeRequestNum("m", 12345, 0));
    expect(a.length).toBeLessThanOrEqual(36);
    expect(makeRequestNum("m", 12345, 0)).not.toBe(makeRequestNum("m", 12345, 1));
  });
});

describe("buildSubmissionPlan", () => {
  const recipients: PlanRecipient[] = [
    { recipientKey: "k1", phone: "01011110001", name: "A", product: "sms" },
    { recipientKey: "k2", phone: "01011110002", name: "B", product: "sms" },
    { recipientKey: "k3", phone: "01011110003", name: "C", product: "alimtalk" },
    { recipientKey: "k4", phone: "01011110004", name: "D", product: "lms" },
  ];

  it("제품별로 배치를 나누고 결정적 requestNum/ref를 부여한다", () => {
    const plan = buildSubmissionPlan({ scope: "m", id: 7, recipients });
    const products = plan.map((b) => b.product).sort();
    expect(products).toEqual(["alimtalk", "lms", "sms"]);

    const requestNums = plan.map((b) => b.requestNum);
    expect(new Set(requestNums).size).toBe(requestNums.length); // 유일
    for (const batch of plan) {
      expect(batch.requestNum.length).toBeLessThanOrEqual(36);
      const refs = batch.recipients.map((r) => r.providerRefKey);
      expect(new Set(refs).size).toBe(refs.length); // 배치 내 유일
      for (const r of batch.recipients) {
        expect(r.providerRefKey.length).toBeLessThanOrEqual(20);
        expect(r.providerRefKey).toMatch(ALNUM);
      }
    }
    const sms = plan.find((b) => b.product === "sms");
    expect(sms?.recipients).toHaveLength(2);
  });

  it("1,000명을 초과하면 제품 내에서 여러 청크로 나눈다", () => {
    const many: PlanRecipient[] = Array.from({ length: 1001 }, (_, i) => ({
      recipientKey: `key-${i}`,
      phone: `0102${String(i).padStart(7, "0")}`,
      product: "sms" as const,
    }));
    const plan = buildSubmissionPlan({ scope: "m", id: 9, recipients: many });
    expect(plan).toHaveLength(2);
    expect(plan[0].recipients).toHaveLength(1000);
    expect(plan[1].recipients).toHaveLength(1);
    expect(plan[0].requestNum).not.toBe(plan[1].requestNum);
  });

  it("빈 수신자는 빈 계획을 반환한다", () => {
    expect(buildSubmissionPlan({ scope: "m", id: 1, recipients: [] })).toEqual([]);
  });
});
