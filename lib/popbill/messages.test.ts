import { afterEach, describe, expect, it, vi } from "vitest";

const sendSMS_multi = vi.fn();
const sendLMS_multi = vi.fn();
const sendATS_multi = vi.fn();
const checkKakaoSenderNumber = vi.fn((...args: unknown[]) => {
  (args[args.length - 2] as (result: { code: number }) => void)({ code: 1 });
});
vi.mock("./sdk", () => ({
  getMessageService: () => ({ sendSMS_multi, sendLMS_multi }),
  getKakaoService: () => ({ sendATS_multi, checkSenderNumber: checkKakaoSenderNumber }),
}));

import { submitMessageBatch } from "./messages";
import { PopbillTimeoutError } from "./types";
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
  kakaoSender: "0212345678",
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
    expect(args[2]).toBe("0212345678"); // sender
    expect(args[3]).toBe(""); // altSendType disabled (대체문자 비활성화)
    const msgs = args[5] as Array<{ rcv: string; msg: string; interOPRefKey: string; altmsg?: string }>;
    expect(msgs[0]).toMatchObject({ rcv: "01011112222", msg: "관리비 안내입니다", interOPRefKey: "r0" });
    expect(msgs[0].altmsg ?? "").toBe("");
    expect(args[8]).toEqual([{ t: "WL", n: "확인", u1: "https://x" }]); // btns
    expect(out.product).toBe("alimtalk");
  });

  it("등록되지 않은 알림톡 발신번호는 provider 접수 전에 거절한다", async () => {
    checkKakaoSenderNumber.mockImplementationOnce((...args: unknown[]) => {
      (args[args.length - 2] as (result: { code: number }) => void)({ code: 0 });
    });

    await expect(
      submitMessageBatch(
        { product: "alimtalk", requestNum: "m1c-unverified", recipients: smsBatch.recipients },
        { body: "관리비 안내입니다", templateCode: "TPL_001" },
        config,
      ),
    ).rejects.toMatchObject({ code: "SENDER_NOT_REGISTERED" });
    expect(sendATS_multi).not.toHaveBeenCalled();
  });

  it("alimtalk 한 배치의 수신자별 버튼 URL을 각 msgs[].btns로 보낸다", async () => {
    sendATS_multi.mockImplementation((...args: unknown[]) => {
      (args[args.length - 2] as (r: string) => void)("RCPT-ATS-BUTTONS");
    });
    await submitMessageBatch(
      {
        product: "alimtalk",
        requestNum: "m1c-buttons",
        recipients: [
          {
            ...smsBatch.recipients[0],
            buttons: [{ t: "WL", n: "상세보기", u1: "https://resident.example/r/token-a" }],
          },
          {
            ...smsBatch.recipients[1],
            buttons: [{ t: "WL", n: "상세보기", u1: "https://resident.example/r/token-b" }],
          },
        ],
      },
      {
        body: "관리비 안내입니다",
        templateCode: "TPL_001",
        buttons: [{ t: "WL", n: "상세보기", u1: "https://resident.example/r/#{상세토큰}" }],
      },
      config,
    );

    const args = sendATS_multi.mock.calls[0];
    const msgs = args[5] as Array<{ btns?: Array<{ u1?: string }> }>;
    expect(msgs[0].btns?.[0].u1).toBe("https://resident.example/r/token-a");
    expect(msgs[1].btns?.[0].u1).toBe("https://resident.example/r/token-b");
    expect(msgs[0].btns?.[0].u1).not.toBe(msgs[1].btns?.[0].u1);
    expect(JSON.stringify(msgs)).not.toContain("#{");
    expect(args[8]).toBeNull();
  });

  it("알림톡 버튼 u1/u2에 미치환 변수가 있으면 provider 호출 전에 거절한다", async () => {
    await expect(
      submitMessageBatch(
        {
          product: "alimtalk",
          requestNum: "m1c-unresolved-button",
          recipients: [
            {
              ...smsBatch.recipients[0],
              buttons: [
                {
                  t: "WL",
                  n: "상세보기",
                  u1: "https://resident.example/r/token-a",
                  u2: "https://resident.example/r/#{상세토큰}",
                },
              ],
            },
          ],
        },
        { body: "치환 완료 본문", templateCode: "TPL_001" },
        config,
      ),
    ).rejects.toMatchObject({ code: "UNRESOLVED_VARIABLES" });
    expect(sendATS_multi).not.toHaveBeenCalled();
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

  const twoRenderedSms = {
    product: "sms" as const,
    requestNum: "m2c0",
    recipients: [
      { recipientKey: "k1", providerRefKey: "r0", phone: "01011112222", name: "홍", renderedBody: "홍님 관리비 3만원" },
      { recipientKey: "k2", providerRefKey: "r1", phone: "01033334444", name: "김", renderedBody: "김님 관리비 5만원" },
    ],
  };

  it("sms 배치는 수신자별 renderedBody를 각 메시지 Contents로 보낸다", async () => {
    sendSMS_multi.mockImplementation((...args: unknown[]) => {
      (args[args.length - 2] as (r: string) => void)("RCPT-SMS2");
    });
    await submitMessageBatch(twoRenderedSms, { body: "공통본문" }, config);
    const messages = sendSMS_multi.mock.calls[0][3] as Array<{ Contents: string }>;
    expect(messages[0].Contents).toBe("홍님 관리비 3만원");
    expect(messages[1].Contents).toBe("김님 관리비 5만원");
  });

  it("lms 배치는 수신자별 renderedBody를 각 메시지 Contents로 보낸다", async () => {
    sendLMS_multi.mockImplementation((...args: unknown[]) => {
      (args[args.length - 2] as (r: string) => void)("RCPT-LMS2");
    });
    await submitMessageBatch(
      { ...twoRenderedSms, product: "lms", requestNum: "m2c1" },
      { body: "공통본문", subject: "안내" },
      config,
    );
    const messages = sendLMS_multi.mock.calls[0][4] as Array<{ Contents: string; Subject: string }>;
    expect(messages[0].Contents).toBe("홍님 관리비 3만원");
    expect(messages[1].Contents).toBe("김님 관리비 5만원");
    expect(messages[0].Subject).toBe("안내");
  });

  it("renderedBody가 없으면 공통 본문으로 대체한다(하위 호환)", async () => {
    sendSMS_multi.mockImplementation((...args: unknown[]) => {
      (args[args.length - 2] as (r: string) => void)("RCPT-SMS3");
    });
    await submitMessageBatch(smsBatch, { body: "공통본문만" }, config);
    const messages = sendSMS_multi.mock.calls[0][3] as Array<{ Contents: string }>;
    expect(messages[0].Contents).toBe("공통본문만");
    expect(messages[1].Contents).toBe("공통본문만");
  });

  it("alimtalk 배치는 수신자별 renderedBody를 각 msg로 보낸다", async () => {
    sendATS_multi.mockImplementation((...args: unknown[]) => {
      (args[args.length - 2] as (r: string) => void)("RCPT-ATS2");
    });
    await submitMessageBatch(
      { ...twoRenderedSms, product: "alimtalk", requestNum: "m2c2" },
      { body: "#{금액}원 청구", templateCode: "TPL_001" },
      config,
    );
    const msgs = sendATS_multi.mock.calls[0][5] as Array<{ msg: string }>;
    expect(msgs[0].msg).toBe("홍님 관리비 3만원");
    expect(msgs[1].msg).toBe("김님 관리비 5만원");
  });

  it("알림톡은 특정 수신자의 renderedBody에 미치환 변수가 있으면 접수 전에 거절한다", async () => {
    const batch = {
      product: "alimtalk" as const,
      requestNum: "m2c3",
      recipients: [
        { recipientKey: "k1", providerRefKey: "r0", phone: "01011112222", name: "홍", renderedBody: "홍님 관리비 3만원" },
        { recipientKey: "k2", providerRefKey: "r1", phone: "01033334444", name: "김", renderedBody: "#{금액}원 청구" },
      ],
    };
    // 공통 본문(content.body)에는 변수가 없어도 특정 수신자 본문이 미치환이면 거절해야 한다.
    await expect(
      submitMessageBatch(batch, { body: "치환완료 공통본문", templateCode: "TPL_001" }, config),
    ).rejects.toThrow();
    expect(sendATS_multi).not.toHaveBeenCalled();
  });
});

describe("submitMessageBatch 타임아웃/이중정산 가드", () => {
  afterEach(() => vi.useRealTimers());

  it("공급자 무응답(콜백 없음)은 PopbillTimeoutError로 거절해 무한 대기를 막는다", async () => {
    vi.useFakeTimers();
    sendSMS_multi.mockImplementation(() => {
      // 성공/오류 콜백 어느 것도 호출하지 않는다(네트워크 침묵).
    });
    const promise = submitMessageBatch(smsBatch, { body: "x" }, config, { timeoutMs: 1000 });
    const assertion = expect(promise).rejects.toBeInstanceOf(PopbillTimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("타임아웃 이후 도착한 지연 콜백은 Promise를 이중 정산하지 않는다", async () => {
    vi.useFakeTimers();
    let lateSuccess: ((r: string) => void) | undefined;
    sendSMS_multi.mockImplementation((...args: unknown[]) => {
      lateSuccess = args[args.length - 2] as (r: string) => void;
    });
    const promise = submitMessageBatch(smsBatch, { body: "x" }, config, { timeoutMs: 1000 });
    const assertion = expect(promise).rejects.toBeInstanceOf(PopbillTimeoutError);
    await vi.advanceTimersByTimeAsync(1000); // 타임아웃이 먼저 정산
    lateSuccess?.("LATE-RCPT"); // 뒤늦은 성공 콜백은 무시되어야 한다
    await assertion; // 여전히 타임아웃으로 reject(성공으로 뒤집히지 않음)
  });

  it("정상 접수는 타이머를 정리하고 receipt로 resolve한다", async () => {
    vi.useFakeTimers();
    sendSMS_multi.mockImplementation((...args: unknown[]) => {
      (args[args.length - 2] as (r: string) => void)("RCPT-OK");
    });
    const out = await submitMessageBatch(smsBatch, { body: "x" }, config, { timeoutMs: 1000 });
    expect(out.receiptNum).toBe("RCPT-OK");
  });
});
