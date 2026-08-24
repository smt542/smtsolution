import { afterEach, describe, expect, it, vi } from "vitest";

const sendSMS_multi = vi.fn();
const sendLMS_multi = vi.fn();
const sendATS_multi = vi.fn();
vi.mock("./sdk", () => ({
  getMessageService: () => ({ sendSMS_multi, sendLMS_multi }),
  getKakaoService: () => ({ sendATS_multi }),
}));

import { submitMessageBatch } from "./messages";
import type { PopbillConfig } from "./config";

const config: PopbillConfig = {
  linkId: "L",
  secretKey: "TOP_SECRET_KEY",
  corpNum: "1234567890",
  userId: "u",
  isTest: true,
  ipRestrictOn: true,
  useStaticIp: false,
  useLocalTime: true,
  smsSender: "0212345678",
  kakaoSender: "@channel",
  faxSender: "0311112222",
};

const smsBatch = {
  product: "sms" as const,
  requestNum: "m1c0",
  recipients: [
    { recipientKey: "k1", providerRefKey: "r0", phone: "01011112222", name: "홍" },
    { recipientKey: "k2", providerRefKey: "r1", phone: "01033334444", name: null },
  ],
};

afterEach(() => vi.clearAllMocks());

describe("submitMessageBatch", () => {
  it("sms 배치는 sendSMS_multi를 호출하고 receipt를 정규화한다", async () => {
    sendSMS_multi.mockImplementation((...args: unknown[]) => {
      (args[args.length - 2] as (r: string) => void)("RCPT-SMS");
    });
    const out = await submitMessageBatch(smsBatch, { body: "안녕하세요" }, config);
    expect(sendSMS_multi).toHaveBeenCalledTimes(1);
    const args = sendSMS_multi.mock.calls[0];
    expect(args[0]).toBe("1234567890"); // corpNum
    expect(args[1]).toBe("0212345678"); // sender
    expect(args[6]).toBe("m1c0"); // requestNum
    const messages = args[3] as Array<{ Receiver: string; Contents: string; interOPRefKey: string }>;
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ Receiver: "01011112222", Contents: "안녕하세요", interOPRefKey: "r0" });
    expect(out).toEqual({
      requestNum: "m1c0",
      receiptNum: "RCPT-SMS",
      product: "sms",
      recipients: [
        { recipientKey: "k1", providerRefKey: "r0" },
        { recipientKey: "k2", providerRefKey: "r1" },
      ],
    });
  });

  it("lms 배치는 sendLMS_multi를 제목과 함께 호출한다", async () => {
    sendLMS_multi.mockImplementation((...args: unknown[]) => {
      (args[args.length - 2] as (r: string) => void)("RCPT-LMS");
    });
    const out = await submitMessageBatch(
      { ...smsBatch, product: "lms", requestNum: "m1c1" },
      { body: "긴 본문".repeat(50), subject: "안내" },
      config,
    );
    expect(sendLMS_multi).toHaveBeenCalledTimes(1);
    const args = sendLMS_multi.mock.calls[0];
    expect(args[2]).toBe("안내"); // subject
    expect(out.product).toBe("lms");
    expect(out.receiptNum).toBe("RCPT-LMS");
  });

  it("alimtalk 배치는 대체문자 없이 sendATS_multi를 호출한다", async () => {
    sendATS_multi.mockImplementation((...args: unknown[]) => {
      (args[args.length - 2] as (r: string) => void)("RCPT-ATS");
    });
    const out = await submitMessageBatch(
      { product: "alimtalk", requestNum: "m1c2", recipients: smsBatch.recipients },
      { body: "관리비 안내입니다", templateCode: "TPL_001", buttons: [{ t: "WL", n: "확인", u1: "https://x" }] },
      config,
    );
    expect(sendATS_multi).toHaveBeenCalledTimes(1);
    const args = sendATS_multi.mock.calls[0];
    expect(args[1]).toBe("TPL_001"); // templateCode
    expect(args[2]).toBe("@channel"); // sender
    expect(args[3]).toBe(""); // altSendType disabled (대체문자 비활성화)
    const msgs = args[5] as Array<{ rcv: string; msg: string; interOPRefKey: string; altmsg?: string }>;
    expect(msgs[0]).toMatchObject({ rcv: "01011112222", msg: "관리비 안내입니다", interOPRefKey: "r0" });
    expect(msgs[0].altmsg ?? "").toBe("");
    expect(args[8]).toEqual([{ t: "WL", n: "확인", u1: "https://x" }]); // btns
    expect(out.product).toBe("alimtalk");
  });

  it("공급자 오류는 비밀값 없이 정규화되어 reject된다", async () => {
    sendSMS_multi.mockImplementation((...args: unknown[]) => {
      (args[args.length - 1] as (e: { code: number; message: string }) => void)({
        code: -99,
        message: "발신번호 미등록",
      });
    });
    const err = (await submitMessageBatch(smsBatch, { body: "x" }, config).catch(
      (e) => e,
    )) as Error & { code?: string };
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("-99");
    expect(err.message).not.toContain("TOP_SECRET_KEY");
  });

  it("알림톡 본문에 미치환 변수가 있으면 provider 호출 전에 거절한다", async () => {
    await expect(
      submitMessageBatch(
        { product: "alimtalk", requestNum: "m1c3", recipients: smsBatch.recipients },
        { body: "#{금액}원 청구", templateCode: "TPL_001" },
        config,
      ),
    ).rejects.toThrow();
    expect(sendATS_multi).not.toHaveBeenCalled();
  });

  it("알림톡 templateCode가 없으면 거절한다", async () => {
    await expect(
      submitMessageBatch(
        { product: "alimtalk", requestNum: "m1c4", recipients: smsBatch.recipients },
        { body: "고정 안내" },
        config,
      ),
    ).rejects.toThrow();
    expect(sendATS_multi).not.toHaveBeenCalled();
  });
});
